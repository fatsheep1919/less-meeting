/**
 * 国际化：根据浏览器语言返回中文或英文文本
 */
type Lang = 'zh' | 'en';

function detectLanguage(): Lang {
  const navLang = (typeof navigator !== 'undefined' && navigator.language) || 'en';
  return navLang.startsWith('zh') ? 'zh' : 'en';
}

const lang: Lang = detectLanguage();

const dict: Record<string, Record<Lang, string>> = {
  // ---- 通用 ----
  appSubtitle:    { zh: '轻量级语音会议',          en: 'Lightweight Voice Meeting' },
  errorConnect:   { zh: '无法连接到服务器',         en: 'Cannot connect to server' },
  copyLink:       { zh: '复制链接',                en: 'Copy Link' },
  copied:         { zh: '已复制',                   en: 'Copied' },
  enterMeeting:   { zh: '进入会议',                en: 'Enter Meeting' },
  joinMeeting:    { zh: '加入会议',                en: 'Join Meeting' },
  roomNameInput:  { zh: '输入房间名称',             en: 'Enter room name' },
  nicknameInput:  { zh: '你的昵称',                en: 'Your nickname' },
  createRoom:     { zh: '创建新房间',              en: 'Create New Room' },
  shareScreen:    { zh: '共享屏幕',                en: 'Share Screen' },
  stopSharing:    { zh: '停止共享',                en: 'Stop Sharing' },
  mic:            { zh: '麦克风',                   en: 'Mic' },
  muted:          { zh: '已静音',                   en: 'Muted' },
  leave:          { zh: '退出',                     en: 'Leave' },
  muteTooltip:    { zh: '静音',                     en: 'Mute' },
  leaveTooltip:   { zh: '退出',                     en: 'Leave' },
  screenTooltip:  { zh: '共享屏幕',                en: 'Share Screen' },
  othersSharing:  { zh: '其他人正在共享屏幕',      en: 'Someone else is sharing' },
  copyLinkTitle:  { zh: '复制会议地址',            en: 'Copy meeting link' },
  urlLabel:       { zh: '会议链接（可分享给参会者）', en: 'Meeting link (share with participants)' },
  joinViaLink:    { zh: '通过分享链接加入会议',    en: 'Join via shared link' },
  waitingOthers:  { zh: '等待其他参会者加入...',    en: 'Waiting for others to join...' },
  leftMeeting:    { zh: '已退出会议，可以关闭此页面', en: 'Left the meeting. You may close this page.' },

  // ---- 校验 / 错误 ----
  needRoomName:   { zh: '请输入房间名称',           en: 'Please enter a room name' },
  needNickname:   { zh: '请输入你的昵称',           en: 'Please enter your nickname' },
  createRoomFail: { zh: '创建房间失败，请确认服务端已启动', en: 'Failed to create room. Check if server is running.' },
  roomNotExist:   { zh: '会议已结束或房间不存在',            en: 'Meeting has ended or room does not exist.' },
  noRtpCap:       { zh: '未获取到路由器 RTP 能力', en: 'Router RTP capabilities not received' },
  noSendTransport:{ zh: '发送 Transport 未创建',   en: 'Send transport not created' },

  // ---- 麦克风/媒体错误 ----
  micUnavailable: {
    zh: '当前通过 HTTP 访问，浏览器禁止使用麦克风。\n解决方法：\n1. 配置域名并启用 HTTPS（推荐）\n2. 或使用 http://localhost 在本地测试',
    en: 'Microphone access is blocked on HTTP connections.\nSolutions:\n1. Set up HTTPS with a domain (recommended)\n2. Or use http://localhost for local testing',
  },
  micNotSupported: {
    zh: '当前浏览器不支持麦克风访问。\n请使用最新版 Chrome/Edge/Firefox。',
    en: 'Your browser does not support microphone.\nPlease use the latest Chrome/Edge/Firefox.',
  },
  micPermission:  { zh: '需要麦克风权限才能加入会议，请在浏览器设置中允许麦克风访问', en: 'Microphone permission is required. Please allow it in browser settings.' },
  micNotFound:    { zh: '未检测到麦克风设备',       en: 'No microphone device detected.' },
  micBusy:        { zh: '麦克风被其他应用占用',     en: 'Microphone is being used by another application.' },
  mediaFailed:    { zh: '媒体连接失败',             en: 'Media connection failed' },
};

/** 是否为移动端浏览器 */
export function isMobile(): boolean {
  return /Android|iPhone|iPad|iPod|webOS/i.test(typeof navigator !== 'undefined' ? navigator.userAgent : '');
}

export function t(key: string): string {
  const entry = dict[key];
  if (!entry) return key;
  return entry[lang] || entry.en || key;
}
