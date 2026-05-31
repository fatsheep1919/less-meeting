import { state } from '../main';
import type { MediaClient } from '../media';
import { t, isMobile } from '../i18n';

/**
 * 底部控制栏：自己的头像昵称 + 静音 + 退出
 */
export function renderControlBar(
  container: HTMLElement,
  media: MediaClient,
  onScreenShareChange?: (sharing: boolean) => void,
): void {
  container.innerHTML = `
    <div class="control-bar">
      <div class="control-self">
        <div class="peer-avatar self-avatar" style="background: #6366f1">
          ${state.displayName.charAt(0).toUpperCase()}
        </div>
        <span class="control-nickname">${escapeHtml(state.displayName)}</span>
      </div>

      <div class="control-buttons">
        ${isMobile() ? '' : `
        <button id="btn-screen" class="ctrl-btn" title="${t('screenTooltip')}">
          <span class="icon">🖥️</span>
          <span class="label">${t('shareScreen')}</span>
        </button>`}
        <button id="btn-mute" class="ctrl-btn" title="${t('muteTooltip')}">
          <span class="icon">🎤</span>
          <span class="label">${t('mic')}</span>
        </button>
        <button id="btn-leave" class="ctrl-btn leave-btn" title="${t('leaveTooltip')}">
          <span class="icon">📞</span>
          <span class="label">${t('leave')}</span>
        </button>
      </div>
    </div>
  `;

  const muteBtn = document.getElementById('btn-mute')!;

  // 共享屏幕按钮
  const screenBtn = document.getElementById('btn-screen')!;
  screenBtn.onclick = async () => {
    if (media.isScreenSharing()) {
      media.stopScreenShare();
      screenBtn.classList.remove('active');
      (screenBtn.querySelector('.icon') as HTMLElement).textContent = '🖥️';
      (screenBtn.querySelector('.label') as HTMLElement).textContent = t('shareScreen');
      onScreenShareChange?.(false);
    } else {
      try {
        await media.startScreenShare();
        screenBtn.classList.add('active');
        (screenBtn.querySelector('.icon') as HTMLElement).textContent = '🖥️';
        (screenBtn.querySelector('.label') as HTMLElement).textContent = t('stopSharing');
        onScreenShareChange?.(true);
      } catch {
        // 用户取消共享或出错
      }
    }
  };

  // 静音按钮
  muteBtn.onclick = () => {
    media.toggleMute();
    const muted = media.isMuted();
    muteBtn.classList.toggle('muted', muted);
    (muteBtn.querySelector('.icon') as HTMLElement).textContent = muted ? '🔇' : '🎤';
    (muteBtn.querySelector('.label') as HTMLElement).textContent = muted ? t('muted') : t('mic');
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
            ${t('leftMeeting')}
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
