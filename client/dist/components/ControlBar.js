import { state, navigateTo } from '../main';
/**
 * 底部控制栏：自己的头像昵称 + 静音 + 退出
 */
export function renderControlBar(container, media) {
    container.innerHTML = `
    <div class="control-bar">
      <div class="control-self">
        <div class="peer-avatar self-avatar" style="background: #6366f1">
          ${state.displayName.charAt(0).toUpperCase()}
        </div>
        <span class="control-nickname">${escapeHtml(state.displayName)}</span>
      </div>

      <div class="control-buttons">
        <button id="btn-mute" class="ctrl-btn" title="静音">
          <span class="icon">🎤</span>
          <span class="label">麦克风</span>
        </button>
        <button id="btn-leave" class="ctrl-btn leave-btn" title="退出">
          <span class="icon">📞</span>
          <span class="label">退出</span>
        </button>
      </div>
    </div>
  `;
    const muteBtn = document.getElementById('btn-mute');
    // 静音按钮
    muteBtn.onclick = () => {
        media.toggleMute();
        const muted = media.isMuted();
        muteBtn.classList.toggle('muted', muted);
        muteBtn.querySelector('.icon').textContent = muted ? '🔇' : '🎤';
        muteBtn.querySelector('.label').textContent = muted ? '已静音' : '麦克风';
    };
    // 退出按钮
    document.getElementById('btn-leave').onclick = () => {
        // 先发信令通知服务端
        state.signaling?.send({ type: 'LEAVE_ROOM' });
        // 清理资源
        state.media?.close();
        state.signaling?.close();
        // 重置状态
        state.peers.clear();
        state.roomId = '';
        state.displayName = '';
        state.signaling = null;
        state.media = null;
        navigateTo('lobby');
    };
}
function escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
}
//# sourceMappingURL=ControlBar.js.map