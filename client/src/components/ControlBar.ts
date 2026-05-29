import { state } from '../main';
import type { MediaClient } from '../media';

/**
 * 底部控制栏：自己的头像昵称 + 静音 + 退出
 */
export function renderControlBar(container: HTMLElement, media: MediaClient): void {
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

  const muteBtn = document.getElementById('btn-mute')!;

  // 静音按钮
  muteBtn.onclick = () => {
    media.toggleMute();
    const muted = media.isMuted();
    muteBtn.classList.toggle('muted', muted);
    (muteBtn.querySelector('.icon') as HTMLElement).textContent = muted ? '🔇' : '🎤';
    (muteBtn.querySelector('.label') as HTMLElement).textContent = muted ? '已静音' : '麦克风';
  };

  // 退出按钮
  document.getElementById('btn-leave')!.onclick = () => {
    // 通知服务端
    state.signaling?.send({ type: 'LEAVE_ROOM' });

    // 清理媒体资源
    state.media?.close();
    state.signaling?.close();

    // 尝试关闭窗口（对于通过 window.open 打开的 tab 有效）
    window.close();

    // 如果浏览器不允许关闭（非 js 打开的窗口），显示退出提示
    setTimeout(() => {
      if (!window.closed) {
        document.body.innerHTML = `
          <div style="display:flex;align-items:center;justify-content:center;height:100vh;
                      background:#0f172a;color:#94a3b8;font-family:sans-serif;font-size:18px">
            已退出会议，可以关闭此页面
          </div>`;
      }
    }, 300);
  };
}

function escapeHtml(s: string): string {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}
