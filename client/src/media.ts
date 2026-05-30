import { Device, types } from 'mediasoup-client';
import type { SignalingClient } from './ws';
import type { ServerMessage } from './types';

/**
 * Mediasoup 客户端 — 设备管理、Transport、Producer/Consumer
 */
export class MediaClient {
  private device: Device | null = null;
  private sendTransport: types.Transport | null = null;
  private recvTransport: types.Transport | null = null;
  private producers = new Map<string, types.Producer>();  // key: 'audio' | 'video'
  private consumers = new Map<string, types.Consumer>();
  private signaling: SignalingClient;
  private localStream: MediaStream | null = null;

  // 音量检测
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private speakingCheckInterval: ReturnType<typeof setInterval> | null = null;
  private isCurrentlySpeaking = false;
  private speakingHoldTimer: ReturnType<typeof setTimeout> | null = null;
  private onLocalSpeakingChange: ((isSpeaking: boolean) => void) | null = null;

  /** NEW_CONSUMER 回调：(peerId, consumer) → void */
  private onNewConsumerCb: ((peerId: string, consumer: types.Consumer) => void) | null = null;

  constructor(signaling: SignalingClient) {
    this.signaling = signaling;
  }

  /** 设置本地说话状态变化回调 */
  setOnLocalSpeakingChange(fn: (isSpeaking: boolean) => void): void {
    this.onLocalSpeakingChange = fn;
  }

  /** 设置新 Consumer 回调 */
  setOnNewConsumer(fn: (peerId: string, consumer: types.Consumer) => void): void {
    this.onNewConsumerCb = fn;
  }

  /** 加载 Device（路由器 RTP 能力） */
  async init(routerRtpCapabilities: Record<string, unknown>): Promise<void> {
    this.device = new Device();
    await this.device.load({ routerRtpCapabilities });
    console.log('[Media] Device 已加载');
  }

  /** 创建发送 Transport（上行音频） */
  async createSendTransport(): Promise<void> {
    if (!this.device) throw new Error('Device 未初始化');

    // 1. 请求服务端创建 Transport
    this.signaling.send({ type: 'CREATE_TRANSPORT', direction: 'send' });

    // 2. 等待 TRANSPORT_CREATED
    const transportData = await this.waitForMessage('TRANSPORT_CREATED');

    // 3. 创建客户端 Transport
    const transport = this.device.createSendTransport({
      id: transportData.transportId,
      iceParameters: transportData.iceParameters as any,
      iceCandidates: transportData.iceCandidates as any,
      dtlsParameters: transportData.dtlsParameters as any,
    });

    // 4. 监听 DTLS 连接
    transport.on('connect', ({ dtlsParameters }, callback) => {
      this.signaling.send({
        type: 'CONNECT_TRANSPORT',
        transportId: transport.id,
        dtlsParameters: dtlsParameters as any,
      });
      callback();
    });

    // 5. 监听 produce 事件（当调用 transport.produce() 时触发）
    transport.on('produce', async ({ kind, rtpParameters }, callback, errback) => {
      try {
        this.signaling.send({
          type: 'PRODUCE',
          transportId: transport.id,
          kind: kind as 'audio' | 'video',
          rtpParameters: rtpParameters as any,
        });

        // 等待服务端返回 PRODUCER_CREATED
        const produceResult = await this.waitForMessage('PRODUCER_CREATED');
        callback({ id: produceResult.producerId });
      } catch (err) {
        errback?.(err as Error);
      }
    });

    this.sendTransport = transport;
    console.log('[Media] 发送 Transport 已创建:', transport.id);
  }

  /** 创建接收 Transport（下行音频） */
  async createRecvTransport(): Promise<void> {
    if (!this.device) throw new Error('Device 未初始化');

    // 1. 请求服务端创建 Transport
    this.signaling.send({ type: 'CREATE_TRANSPORT', direction: 'recv' });

    // 2. 等待 TRANSPORT_CREATED
    const transportData = await this.waitForMessage('TRANSPORT_CREATED');

    // 3. 创建客户端 Transport
    const transport = this.device.createRecvTransport({
      id: transportData.transportId,
      iceParameters: transportData.iceParameters as any,
      iceCandidates: transportData.iceCandidates as any,
      dtlsParameters: transportData.dtlsParameters as any,
    });

    // 4. 监听 DTLS 连接
    transport.on('connect', ({ dtlsParameters }, callback) => {
      this.signaling.send({
        type: 'CONNECT_TRANSPORT',
        transportId: transport.id,
        dtlsParameters: dtlsParameters as any,
      });
      callback();
    });

    // 5. 持久监听 NEW_CONSUMER（服务端推送）
    this.signaling.on('NEW_CONSUMER', async (msg: ServerMessage) => {
      if (msg.type !== 'NEW_CONSUMER') return;

      try {
        const consumer = await transport.consume({
          id: msg.consumerId,
          producerId: msg.producerId,
          kind: msg.kind as 'audio',
          rtpParameters: msg.rtpParameters as any,
        });

        this.consumers.set(msg.consumerId, consumer);
        console.log('[Media] Consuming:', msg.producerId, 'for peer:', msg.peerId);

        this.onNewConsumerCb?.(msg.peerId, consumer);
      } catch (err) {
        console.error('[Media] Consumer 创建失败:', err);
      }
    });

    this.recvTransport = transport;
    console.log('[Media] 接收 Transport 已创建:', transport.id);
  }

  /** 打开麦克风并推流 */
  async startProduce(): Promise<void> {
    if (!this.sendTransport) throw new Error('发送 Transport 未创建');

    // 检查是否在非安全上下文中（HTTP + 非 localhost）
    const isInsecureHttp = location.protocol === 'http:' &&
      location.hostname !== 'localhost' &&
      location.hostname !== '127.0.0.1';

    if (!navigator.mediaDevices?.getUserMedia) {
      if (isInsecureHttp) {
        throw new Error(
          'BrowserMediaUnavailable: 当前通过 HTTP 访问，浏览器禁止使用麦克风。\n' +
          '解决方法：\n' +
          '1. 配置域名并启用 HTTPS（推荐）\n' +
          '2. 或使用 http://localhost 在本地测试'
        );
      }
      throw new Error(
        'BrowserMediaUnavailable: 当前浏览器不支持麦克风访问。\n' +
        '请使用最新版 Chrome/Edge/Firefox。'
      );
    }

    this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const audioTrack = this.localStream.getAudioTracks()[0];

    if (audioTrack) {
      const audioProducer = await this.sendTransport.produce({ track: audioTrack });
      this.producers.set('audio', audioProducer);
      console.log('[Media] 音频推流, producerId:', audioProducer.id);

      // 启动音量检测（用于说话状态指示）
      this.startVolumeDetection(this.localStream);
    }
  }

  /** 开始屏幕共享并推流视频 */
  async startScreenShare(): Promise<types.Producer | null> {
    if (!this.sendTransport) throw new Error('发送 Transport 未创建');

    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });
      const videoTrack = screenStream.getVideoTracks()[0];
      if (!videoTrack) return null;

      const videoProducer = await this.sendTransport.produce({ track: videoTrack });
      this.producers.set('video', videoProducer);
      console.log('[Media] 屏幕共享推流, producerId:', videoProducer.id);

      // 监听用户通过浏览器 UI 停止共享
      videoTrack.addEventListener('ended', () => {
        this.stopScreenShare();
      });

      return videoProducer;
    } catch (err) {
      console.error('[Media] 屏幕共享失败:', err);
      throw err;
    }
  }

  /** 停止屏幕共享 */
  stopScreenShare(): void {
    const videoProducer = this.producers.get('video');
    if (videoProducer) {
      videoProducer.close();
      this.producers.delete('video');
      console.log('[Media] 屏幕共享已停止');
    }
  }

  /** 是否正在共享屏幕 */
  isScreenSharing(): boolean {
    return this.producers.has('video');
  }

  /**
   * 启动本地音量检测，使用 RMS + hold time 保证响应及时且不闪烁。
   * 检测到说话立即上报；停止说话延迟 400ms 再上报（hold time）。
   */
  private startVolumeDetection(stream: MediaStream): void {
    try {
      this.audioContext = new AudioContext();
      const source = this.audioContext.createMediaStreamSource(stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      source.connect(this.analyser);

      const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
      const VOLUME_THRESHOLD = 4;    // RMS 阈值（0-128 量级）
      const HOLD_MS = 400;           // 停止说话后的保持时间

      const notifySpeaking = (isSpeaking: boolean): void => {
        if (isSpeaking === this.isCurrentlySpeaking) return;
        this.isCurrentlySpeaking = isSpeaking;
        this.onLocalSpeakingChange?.(isSpeaking);
        if (isSpeaking) {
          this.signaling.send({ type: 'SPEAKER_ACTIVE' });
        } else {
          this.signaling.send({ type: 'SPEAKER_INACTIVE' });
        }
      };

      this.speakingCheckInterval = setInterval(() => {
        if (!this.analyser) return;

        // 使用时域波形计算 RMS（比频域更精确反映语音响度）
        this.analyser.getByteTimeDomainData(dataArray);
        let sumSquares = 0;
        for (let i = 0; i < dataArray.length; i++) {
          const normalized = (dataArray[i] - 128) / 128; // 归一化到 [-1, 1]
          sumSquares += normalized * normalized;
        }
        const rms = Math.sqrt(sumSquares / dataArray.length) * 100; // 放大到 0-100

        if (rms > VOLUME_THRESHOLD) {
          // 说话中：取消 hold timer，立即上报
          if (this.speakingHoldTimer) {
            clearTimeout(this.speakingHoldTimer);
            this.speakingHoldTimer = null;
          }
          notifySpeaking(true);
        } else if (this.isCurrentlySpeaking && !this.speakingHoldTimer) {
          // 刚停止说话：启动 hold timer
          this.speakingHoldTimer = setTimeout(() => {
            this.speakingHoldTimer = null;
            notifySpeaking(false);
          }, HOLD_MS);
        }
      }, 150);
    } catch (err) {
      console.warn('[Media] 音量检测启动失败:', err);
    }
  }

  /** 停止音量检测 */
  private stopVolumeDetection(): void {
    if (this.speakingCheckInterval) {
      clearInterval(this.speakingCheckInterval);
      this.speakingCheckInterval = null;
    }
    if (this.speakingHoldTimer) {
      clearTimeout(this.speakingHoldTimer);
      this.speakingHoldTimer = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(() => {});
    }
    this.audioContext = null;
    this.analyser = null;
  }

  /** 切换静音 */
  toggleMute(): void {
    if (!this.localStream) return;
    const track = this.localStream.getAudioTracks()[0];
    if (!track) return;

    track.enabled = !track.enabled;
    if (track.enabled) {
      this.signaling.send({ type: 'UNMUTE' });
      this.producers.get('audio')?.resume();
    } else {
      this.signaling.send({ type: 'MUTE' });
      this.producers.get('audio')?.pause();
    }
  }

  /** 是否处于静音状态 */
  isMuted(): boolean {
    return this.localStream?.getAudioTracks()[0]?.enabled === false;
  }

  /** 获取指定 consumerId 的远程音频流 Track */
  getConsumerTrack(consumerId: string): MediaStreamTrack | null {
    return this.consumers.get(consumerId)?.track ?? null;
  }

  /** 清理所有资源 */
  close(): void {
    this.stopVolumeDetection();
    for (const producer of this.producers.values()) {
      producer.close();
    }
    this.producers.clear();
    this.consumers.forEach((c) => c.close());
    this.consumers.clear();
    this.sendTransport?.close();
    this.recvTransport?.close();
    this.localStream?.getTracks().forEach((t) => t.stop());
    console.log('[Media] 资源已清理');
  }

  // ---- 工具方法 ----

  /** 等待服务端特定类型的消息 */
  private waitForMessage(type: string): Promise<any> {
    return new Promise((resolve) => {
      const handler = (msg: ServerMessage) => {
        this.signaling.off(type, handler);
        resolve(msg);
      };
      this.signaling.on(type, handler);
    });
  }
}