import { navigateTo, state } from '../main';
import { SignalingClient } from '../ws';
import type { ServerMessage } from '../types';

/**
 * 首页 —— 简化为两种模式：
 *   1. 主页 /          → 只显示「创建房间」表单
 *   2. 直链 /room/:id  → 只显示「昵称 + 加入」表单
 */
export async function showLobby(container: HTMLElement): Promise<void> {
  const urlRoomId = extractRoomFromPath();
  const urlPasscode = extractPasscodeFromQuery();
  const isDirectLink = !!(urlRoomId && urlPasscode);

  if (isDirectLink) {
    await renderDirectLink(container, urlRoomId!, urlPasscode!);
  } else {
    renderCreateOnly(container);
  }
}

// ============================================
// 模式一：主页 — 创建房间
// ============================================

function renderCreateOnly(container: HTMLElement): void {
  // 闭包中保存创建结果
  let createdRoomId = '';
  let createdPasscode = '';
  let createdRoomName = '';

  container.innerHTML = `
    <div class="lobby">
      <h1>🎙️ Less Meeting</h1>
      <p class="subtitle">轻量级语音会议</p>

      <div class="lobby-card">
        <div class="create-section">
          <input id="input-room-name" type="text" placeholder="输入房间名称" maxlength="20" autocomplete="off" />
          <button id="btn-create-room" class="btn-primary">创建新房间</button>

          <div id="created-result" style="display:none">
            <p class="url-label">会议链接（可分享给参会者）</p>
            <div class="url-row">
              <input id="input-room-url" type="text" readonly />
              <button id="btn-copy-url" class="btn-copy">复制链接</button>
              <button id="btn-enter-meeting" class="btn-enter">进入会议</button>
            </div>
          </div>
        </div>
      </div>

      <p id="lobby-error" class="error" style="display:none"></p>
    </div>
  `;

  const showError = (text: string): void => {
    const el = document.getElementById('lobby-error')!;
    el.textContent = text;
    el.style.display = 'block';
    setTimeout(() => { el.style.display = 'none'; }, 4000);
  };

  // ---- 创建房间 ----
  document.getElementById('btn-create-room')!.onclick = async () => {
    const name = (document.getElementById('input-room-name') as HTMLInputElement).value.trim();
    if (!name) { showError('请输入房间名称'); return; }

    try {
      const res = await fetch('/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error('请求失败');
      const data = await res.json();

      createdRoomId = data.roomId;
      createdPasscode = data.passcode;
      createdRoomName = data.name;

      const urlStr = `${location.origin}${data.url}`;
      (document.getElementById('input-room-url') as HTMLInputElement).value = urlStr;
      document.getElementById('created-result')!.style.display = 'block';
    } catch {
      showError('创建房间失败，请确认服务端已启动');
    }
  };

  // ---- 复制链接 ----
  document.getElementById('btn-copy-url')!.onclick = async () => {
    const input = document.getElementById('input-room-url') as HTMLInputElement;
    const btn = document.getElementById('btn-copy-url')!;
    try {
      await navigator.clipboard.writeText(input.value);
      btn.textContent = '已复制';
      setTimeout(() => { btn.textContent = '复制链接'; }, 2000);
    } catch {
      input.select();
      document.execCommand('copy');
      btn.textContent = '已复制';
      setTimeout(() => { btn.textContent = '复制链接'; }, 2000);
    }
  };

  // ---- 进入会议（新 tab 打开直链，保持入会步骤一致） ----
  document.getElementById('btn-enter-meeting')!.onclick = () => {
    const url = (document.getElementById('input-room-url') as HTMLInputElement).value;
    if (url) window.open(url, '_blank');
  };

  // 房间名输入框回车触发创建
  document.getElementById('input-room-name')!.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      document.getElementById('btn-create-room')!.click();
    }
  });
}

// ============================================
// 模式二：直链 — 输入昵称加入
// ============================================

async function renderDirectLink(container: HTMLElement, roomId: string, passcode: string): Promise<void> {
  // 获取房间名
  let roomName = '';
  try {
    const res = await fetch(`/api/rooms/${roomId}`);
    if (res.ok) {
      const data = await res.json();
      roomName = data.name || '';
    }
  } catch {
    // 获取失败就留空
  }

  container.innerHTML = `
    <div class="lobby">
      <h1>🎙️ Less Meeting</h1>
      <p class="subtitle">通过分享链接加入会议</p>

      <div class="lobby-card">
        ${roomName ? `<div class="room-name-banner">${escapeHtml(roomName)}</div>` : ''}
        <div class="join-form">
          <input id="input-nickname" type="text" placeholder="你的昵称" maxlength="12" autocomplete="off" />
          <button id="btn-join-room" class="btn-primary">加入会议</button>
        </div>
      </div>

      <p id="lobby-error" class="error" style="display:none"></p>
    </div>
  `;

  const showError = (text: string): void => {
    const el = document.getElementById('lobby-error')!;
    el.textContent = text;
    el.style.display = 'block';
    setTimeout(() => { el.style.display = 'none'; }, 4000);
  };

  document.getElementById('btn-join-room')!.onclick = () => {
    const displayName = (document.getElementById('input-nickname') as HTMLInputElement).value.trim();
    if (!displayName) { showError('请输入你的昵称'); return; }
    joinRoom(roomId, passcode, displayName, undefined, showError);
  };

  const nickInput = document.getElementById('input-nickname')!;
  nickInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      document.getElementById('btn-join-room')!.click();
    }
  });
  nickInput.focus();
}

// ============================================
// 工具函数
// ============================================

function extractRoomFromPath(): string | null {
  const match = location.pathname.match(/^\/room\/([A-Za-z0-9]+)$/);
  return match ? match[1] : null;
}

function extractPasscodeFromQuery(): string | null {
  return new URLSearchParams(location.search).get('p');
}

async function joinRoom(
  roomId: string,
  passcode: string,
  displayName: string,
  roomName: string | undefined,
  showError: (text: string) => void,
): Promise<void> {
  try {
    const signaling = new SignalingClient();
    await signaling.connect();

    signaling.send({ type: 'JOIN_ROOM', roomId, passcode, displayName });

    signaling.on('ROOM_JOINED', (msg: ServerMessage) => {
      if (msg.type !== 'ROOM_JOINED') return;

      state.roomId = msg.roomId;
      state.peerId = msg.peerId;
      state.displayName = displayName;
      state.roomName = roomName || msg.roomName;
      state.signaling = signaling;

      state.peers.clear();
      for (const p of msg.peers) {
        state.peers.set(p.id, { id: p.id, displayName: p.displayName });
      }

      state.routerRtpCapabilities = msg.routerRtpCapabilities;

      navigateTo('meeting');
    });

    signaling.on('ERROR', (msg: ServerMessage) => {
      if (msg.type !== 'ERROR') return;
      showError(msg.message);
      signaling.close();
    });
  } catch {
    showError('无法连接到服务器');
  }
}

function escapeHtml(s: string): string {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}
