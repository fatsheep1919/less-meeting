/**
 * 全局配置
 */
export const config = {
  // HTTP / WebSocket 监听
  listenIp: '0.0.0.0',
  listenPort: 3000,

  // 对外宣告的 IP（公网部署时改为实际公网 IP）
  announcedIp: process.env.ANNOUNCED_IP || '127.0.0.1',

  // Mediasoup Worker
  worker: {
    logLevel: 'warn' as const,
    rtcMinPort: 40000,
    rtcMaxPort: 49999,
  },

  // WebRTC Transport 比特率限制
  transport: {
    maxIncomeBitrate: 256_000,           // 单条上行流上限
    initialAvailableOutgoingBitrate: 512_000, // 下行初始带宽
  },

  // 音频编码配置
  audioCodec: {
    mimeType: 'audio/opus' as const,
    clockRate: 48000,
    channels: 2,
    parameters: {
    },
  },

  // 房间限制
  maxPeersPerRoom: 10,

  // 口令长度
  passcodeLength: 6,

  // ICE 服务器（STUN / TURN）
  iceServers: [
    { urls: ['stun:stun.l.google.com:19302'] },
  ],
} as const;

/**
 * ICE 服务器配置（用于客户端）
 */
export const iceServerConfig = config.iceServers;