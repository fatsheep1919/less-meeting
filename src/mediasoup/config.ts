import * as mediasoup from 'mediasoup';
import type { types } from 'mediasoup';
import { config } from '../config';

/**
 * Mediasoup 音频编解码器配置
 */
export const mediaCodecs: types.RtpCodecCapability[] = [
  {
    kind: 'audio',
    mimeType: config.audioCodec.mimeType,
    clockRate: config.audioCodec.clockRate,
    channels: config.audioCodec.channels,
    preferredPayloadType: 100,
    parameters: {
      ...config.audioCodec.parameters,
    },
  },
  {
    kind: 'video',
    mimeType: 'video/VP8',
    clockRate: 90000,
    preferredPayloadType: 101,
    parameters: {
      'x-google-start-bitrate': 1000,
    },
  },
];

/**
 * WebRtcTransport 配置
 */
export function getTransportConfig(): types.WebRtcTransportOptions {
  return {
    listenIps: [
      {
        ip: config.listenIp,
        announcedIp: config.announcedIp,
      },
    ],
    enableUdp: true,
    enableTcp: true,
    preferUdp: true,
    initialAvailableOutgoingBitrate: config.transport.initialAvailableOutgoingBitrate,
  };
}