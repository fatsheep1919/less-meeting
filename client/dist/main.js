import { showLobby } from './pages/Lobby';
import { showMeeting } from './pages/Meeting';
/**
 * 全局应用状态
 */
export const state = {
    roomId: '',
    roomName: '',
    peerId: '',
    displayName: '',
    peers: new Map(),
    signaling: null,
    media: null,
    routerRtpCapabilities: null,
};
const app = document.getElementById('app');
/**
 * 页面路由
 */
export function navigateTo(page) {
    app.innerHTML = '';
    if (page === 'lobby') {
        showLobby(app);
    }
    else {
        showMeeting(app);
    }
}
// 启动 → 首页
navigateTo('lobby');
//# sourceMappingURL=main.js.map