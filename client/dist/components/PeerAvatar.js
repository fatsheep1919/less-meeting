import { state } from '../main';
/** 颜色池 */
const AVATAR_COLORS = ['#4f46e5', '#0891b2', '#059669', '#d97706', '#dc2626', '#7c3aed', '#db2777'];
/**
 * 按 seed 选一种颜色
 */
function avatarColor(seed) {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        hash = seed.charCodeAt(i) + ((hash << 5) - hash);
    }
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}
/**
 * 渲染参会者头像网格
 */
export function renderPeerGrid(container, speakingIds) {
    const peers = Array.from(state.peers.values());
    if (peers.length === 0) {
        container.innerHTML = `<p class="empty-hint">等待其他参会者加入...</p>`;
        return;
    }
    container.innerHTML = peers
        .map((p) => {
        const isSpeaking = speakingIds?.has(p.id) ?? false;
        return `
    <div class="peer-card${isSpeaking ? ' speaking' : ''}" id="peer-card-${p.id}">
      <div class="peer-avatar" style="background: ${avatarColor(p.id)}">
        ${p.displayName.charAt(0).toUpperCase()}
      </div>
      <span class="peer-name" title="${escapeHtml(p.displayName)}">${escapeHtml(p.displayName)}</span>
    </div>
  `;
    })
        .join('');
}
/**
 * 将远程音频 Track 绑定到对应 Peer 的 <audio> 元素。
 * <audio> 元素统一挂在 document.body，避免 renderPeerGrid 重建 DOM 时被销毁。
 */
export function attachAudioTrack(peerId, track) {
    let audioEl = document.getElementById(`audio-${peerId}`);
    if (!audioEl) {
        audioEl = document.createElement('audio');
        audioEl.id = `audio-${peerId}`;
        audioEl.autoplay = true;
        audioEl.setAttribute('playsinline', '');
        document.body.appendChild(audioEl);
    }
    const stream = new MediaStream([track]);
    audioEl.srcObject = stream;
}
function escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
}
//# sourceMappingURL=PeerAvatar.js.map