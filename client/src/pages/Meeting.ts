import { state, navigateTo } from '../main';
import { MediaClient } from '../media';
import { renderControlBar } from '../components/ControlBar';
import { renderPeerGrid, attachAudioTrack } from '../components/PeerAvatar';
import type { ServerMessage } from '../types';

/**
 * 会议页面
 */
export function showMeeting(container: HTMLElement): void {
  container.innerHTML = `
    <div class="meeting">
      <div id="room-header">
        <span class="room-name">${escapeHtml(state.roomName || state.roomId)}</span>
        <button id="btn-copy-link" class="btn-copy-link" title="复制会议地址">📋 复制链接</button>
      </div>
      <div id="peer-grid" class="peer-grid"></div>
      <div id="control-bar"></div>
    </div>
  `;

  const signaling = state.signaling!;
  const mediaClient = new MediaClient(signaling);
  state.media = mediaClient;

  // 正在说话的人
  const speakingPeerIds = new Set<string>();

  // 刷新参会者网格
  function refreshGrid(): void {
    const grid = document.getElementById('peer-grid');
    if (grid) renderPeerGrid(grid, speakingPeerIds);
  }

  // ---- 绑定远程音频流 ----
  mediaClient.setOnNewConsumer((peerId, consumer) => {
    attachAudioTrack(peerId, consumer.track);
  });

  // 本地说话状态变化（自己的头像也显示高亮）
  mediaClient.setOnLocalSpeakingChange((isSpeaking) => {
    if (isSpeaking) {
      speakingPeerIds.add(state.peerId);
    } else {
      speakingPeerIds.delete(state.peerId);
    }
    refreshGrid();
  });

  // ---- 信令事件 ----
  signaling.on('PEER_JOINED', (msg: ServerMessage) => {
    if (msg.type !== 'PEER_JOINED') return;
    state.peers.set(msg.peerId, { id: msg.peerId, displayName: msg.displayName });
    refreshGrid();
  });

  signaling.on('PEER_LEFT', (msg: ServerMessage) => {
    if (msg.type !== 'PEER_LEFT') return;
    state.peers.delete(msg.peerId);
    speakingPeerIds.delete(msg.peerId);
    refreshGrid();
  });

  // ---- 说话状态 ----
  signaling.on('SPEAKER_ACTIVE', (msg: ServerMessage) => {
    if (msg.type !== 'SPEAKER_ACTIVE') return;
    speakingPeerIds.add(msg.peerId);
    refreshGrid();
  });
  signaling.on('SPEAKER_INACTIVE', (msg: ServerMessage) => {
    if (msg.type !== 'SPEAKER_INACTIVE') return;
    speakingPeerIds.delete(msg.peerId);
    refreshGrid();
  });

  // 服务端断线 / 被踢
  signaling.setOnClose(() => {
    mediaClient.close();
    state.signaling = null;
    state.media = null;
    state.peers.clear();
    navigateTo('lobby');
  });

  // 错误提示
  signaling.on('ERROR', (msg: ServerMessage) => {
    if (msg.type !== 'ERROR') return;
    alert(`错误: ${msg.message}`);
  });

  // ---- 复制会议链接 ----
  document.getElementById('btn-copy-link')!.onclick = async () => {
    const url = `${location.origin}/room/${state.roomId}?p=`;
    // passcode 不在客户端存储，但从 URL 或初始状态推断
    // 简化处理：使用当前页面的完整 URL（如果是从直链进入）
    const currentUrl = location.href;
    try {
      await navigator.clipboard.writeText(currentUrl || url);
      const btn = document.getElementById('btn-copy-link')!;
      btn.textContent = '✅ 已复制';
      setTimeout(() => { btn.textContent = '📋 复制链接'; }, 2000);
    } catch {
      // fallback
    }
  };

  // ---- 渲染 ----
  renderControlBar(document.getElementById('control-bar')!, mediaClient);
  refreshGrid();

  // ---- 异步初始化媒体 ----
  async function initMedia(): Promise<void> {
    const capabilities = state.routerRtpCapabilities;
    if (!capabilities) {
      throw new Error('未获取到路由器 RTP 能力');
    }
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
