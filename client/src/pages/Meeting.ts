import { state, navigateTo } from '../main';
import { MediaClient } from '../media';
import { renderControlBar } from '../components/ControlBar';
import { renderPeerGrid, renderPeerList, attachAudioTrack, attachVideoTrack } from '../components/PeerAvatar';
import type { ServerMessage } from '../types';

/**
 * 会议页面 — 支持屏幕共享双布局
 */
export function showMeeting(container: HTMLElement): void {
  // 谁在共享屏幕（自己的 peerId 或远程 peerId）
  let screenSharePeerId: string | null = null;

  container.innerHTML = `
    <div class="meeting">
      <div id="room-header">
        <span class="room-name">${escapeHtml(state.roomName || state.roomId)}</span>
        <button id="btn-copy-link" class="btn-copy-link" title="复制会议地址">📋 复制链接</button>
      </div>
      <div id="main-area">
        <div id="screen-container" class="screen-container" style="display:none">
          <video id="screen-video" autoplay playsinline muted></video>
        </div>
        <div id="peer-area" class="peer-area"></div>
      </div>
      <div id="control-bar"></div>
    </div>
  `;

  const signaling = state.signaling!;
  const mediaClient = new MediaClient(signaling);
  state.media = mediaClient;

  const speakingPeerIds = new Set<string>();

  // 刷新布局
  function renderLayout(): void {
    const peerArea = document.getElementById('peer-area')!;
    const screenContainer = document.getElementById('screen-container')!;

    // 自己共享时不展示 screen-container（防止反馈循环）
    const showScreen = screenSharePeerId && screenSharePeerId !== state.peerId;

    if (showScreen) {
      // 屏幕共享模式：左侧画面 + 右侧小头像
      screenContainer.style.display = 'flex';
      peerArea.style.flex = '';
      renderPeerList(peerArea, speakingPeerIds);
    } else {
      // 默认模式：居中大网格
      screenContainer.style.display = 'none';
      peerArea.style.flex = '1';
      renderPeerGrid(peerArea, speakingPeerIds);
    }
  }

  // 注册 Consumer 回调
  mediaClient.setOnNewConsumer((peerId, consumer) => {
    if (consumer.kind === 'video') {
      // 视频流 → 绑定到屏幕共享区
      attachVideoTrack(peerId, consumer.track, () => {
        screenSharePeerId = peerId;
        renderLayout();
      });
    } else {
      attachAudioTrack(peerId, consumer.track);
    }
  });

  // 本地屏幕共享状态变化
  const onScreenShareChange = (sharing: boolean): void => {
    if (sharing) {
      screenSharePeerId = state.peerId;
    } else if (screenSharePeerId === state.peerId) {
      screenSharePeerId = null;
    }
    renderLayout();
  };

  // 浏览器原生「停止分享」按钮的兜底回调
  mediaClient.setOnScreenShareEnd(() => {
    if (screenSharePeerId === state.peerId) {
      screenSharePeerId = null;
      renderLayout();
      // 重置 ControlBar 按钮状态
      const screenBtn = document.getElementById('btn-screen');
      if (screenBtn) {
        screenBtn.classList.remove('active');
        (screenBtn.querySelector('.icon') as HTMLElement).textContent = '🖥️';
        (screenBtn.querySelector('.label') as HTMLElement).textContent = '共享屏幕';
      }
    }
  });

  // 本地说话状态
  mediaClient.setOnLocalSpeakingChange((isSpeaking) => {
    if (isSpeaking) speakingPeerIds.add(state.peerId);
    else speakingPeerIds.delete(state.peerId);
    renderLayout();
  });

  // 信令事件
  signaling.on('PEER_JOINED', (msg: ServerMessage) => {
    if (msg.type !== 'PEER_JOINED') return;
    state.peers.set(msg.peerId, { id: msg.peerId, displayName: msg.displayName });
    renderLayout();
  });

  signaling.on('PEER_LEFT', (msg: ServerMessage) => {
    if (msg.type !== 'PEER_LEFT') return;
    state.peers.delete(msg.peerId);
    speakingPeerIds.delete(msg.peerId);
    if (screenSharePeerId === msg.peerId) screenSharePeerId = null;
    renderLayout();
  });

  signaling.on('SPEAKER_ACTIVE', (msg: ServerMessage) => {
    if (msg.type !== 'SPEAKER_ACTIVE') return;
    speakingPeerIds.add(msg.peerId);
    renderLayout();
  });
  signaling.on('SPEAKER_INACTIVE', (msg: ServerMessage) => {
    if (msg.type !== 'SPEAKER_INACTIVE') return;
    speakingPeerIds.delete(msg.peerId);
    renderLayout();
  });

  signaling.setOnClose(() => {
    mediaClient.close();
    state.signaling = null;
    state.media = null;
    state.peers.clear();
    navigateTo('lobby');
  });

  signaling.on('ERROR', (msg: ServerMessage) => {
    if (msg.type !== 'ERROR') return;
    alert(`错误: ${msg.message}`);
  });

  // 复制会议链接
  document.getElementById('btn-copy-link')!.onclick = async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      const btn = document.getElementById('btn-copy-link')!;
      btn.textContent = '✅ 已复制';
      setTimeout(() => { btn.textContent = '📋 复制链接'; }, 2000);
    } catch { /* fallback */ }
  };

  // 渲染控制栏
  renderControlBar(document.getElementById('control-bar')!, mediaClient, onScreenShareChange);

  // 初始渲染
  renderLayout();

  // 异步初始化媒体
  async function initMedia(): Promise<void> {
    const capabilities = state.routerRtpCapabilities;
    if (!capabilities) throw new Error('未获取到路由器 RTP 能力');
    await mediaClient.init(capabilities);
    await mediaClient.createRecvTransport();
    await mediaClient.createSendTransport();
    await mediaClient.startProduce();
  }

  initMedia().catch((err) => {
    console.error('[Meeting] 媒体初始化失败:', err);
    const message = err instanceof Error ? err.message : String(err);

    if (message.includes('BrowserMediaUnavailable')) {
      alert(message.replace('BrowserMediaUnavailable: ', ''));
    } else if (message.includes('NotAllowedError') || message.includes('Permission')) {
      alert('需要麦克风权限才能加入会议，请在浏览器设置中允许麦克风访问');
    } else if (message.includes('NotFoundError')) {
      alert('未检测到麦克风设备');
    } else if (message.includes('NotReadableError')) {
      alert('麦克风被其他应用占用');
    } else {
      alert(`媒体连接失败: ${message}`);
    }
  });
}

function escapeHtml(s: string): string {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}
