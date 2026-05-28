import { showLobby } from './pages/Lobby';
import { showMeeting } from './pages/Meeting';
import type { SignalingClient } from './ws';
import type { MediaClient } from './media';

/**
 * 全局应用状态
 */
export const state = {
  roomId: '',
  roomName: '',
  peerId: '',
  displayName: '',
  peers: new Map<string, { id: string; displayName: string }>(),
  signaling: null as SignalingClient | null,
  media: null as MediaClient | null,
  routerRtpCapabilities: null as Record<string, unknown> | null,
};

const app = document.getElementById('app')!;

/**
 * 页面路由
 */
export function navigateTo(page: 'lobby' | 'meeting'): void {
  app.innerHTML = '';
  if (page === 'lobby') {
    showLobby(app);
  } else {
    showMeeting(app);
  }
}

// 启动 → 首页
navigateTo('lobby');
