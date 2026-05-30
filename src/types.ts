// mediasoup Types 引用
import type {
  Worker,
  Router,
  WebRtcTransport,
  Producer,
  Consumer,
  RtpCapabilities,
  RtpParameters,
  DtlsParameters,
  IceParameters,
  IceCandidate,
  TransportListenInfo,
} from 'mediasoup/node/lib/types';

/**
 * 客户端 ↔ 服务端 信令消息类型
 */
export type ClientMessage =
  | { type: 'JOIN_ROOM'; roomId: string; passcode: string; displayName: string }
  | { type: 'LEAVE_ROOM' }
  | { type: 'CREATE_TRANSPORT'; direction: 'send' | 'recv' }
  | { type: 'CONNECT_TRANSPORT'; transportId: string; dtlsParameters: DtlsParameters }
  | { type: 'PRODUCE'; transportId: string; kind: 'audio' | 'video'; rtpParameters: RtpParameters }
  | { type: 'CONSUME'; producerId: string; rtpCapabilities: RtpCapabilities }
  | { type: 'MUTE' }
  | { type: 'UNMUTE' }
  | { type: 'CHAT'; text: string }
  | { type: 'SPEAKER_ACTIVE' }
  | { type: 'SPEAKER_INACTIVE' }
  | { type: 'PING' };

export type ServerMessage =
  | { type: 'ROOM_JOINED'; roomId: string; roomName: string; peerId: string; peers: PeerInfo[]; routerRtpCapabilities: RtpCapabilities }
  | { type: 'PEER_JOINED'; peerId: string; displayName: string }
  | { type: 'PEER_LEFT'; peerId: string }
  | { type: 'TRANSPORT_CREATED'; transportId: string; iceParameters: IceParameters; iceCandidates: IceCandidate[]; dtlsParameters: DtlsParameters }
  | { type: 'PRODUCER_CREATED'; producerId: string }
  | { type: 'NEW_CONSUMER'; peerId: string; consumerId: string; kind: 'audio' | 'video'; producerId: string; rtpParameters: RtpParameters }
  | { type: 'SPEAKER_ACTIVE'; peerId: string }
  | { type: 'SPEAKER_INACTIVE'; peerId: string }
  | { type: 'CHAT'; peerId: string; displayName: string; text: string }
  | { type: 'ERROR'; code: string; message: string }
  | { type: 'PONG' };

/**
 * 参会者信息（发送给其他人的简化版）
 */
export interface PeerInfo {
  id: string;
  displayName: string;
}

/**
 * 房间内的完整 Peer 状态
 */
export interface Peer {
  id: string;
  displayName: string;
  ws: import('ws').WebSocket;
  sendTransport?: WebRtcTransport;
  recvTransport?: WebRtcTransport;
  producers: Map<string, Producer>;         // key: 'audio' | 'video'
  consumers: Map<string, Consumer>;
  isMuted: boolean;
}

/**
 * 房间
 */
export interface Room {
  id: string;
  name: string;
  passcode: string;
  router: Router;
  peers: Map<string, Peer>;
  maxPeers: number;
  createdAt: Date;
}

export type { Worker, Router, WebRtcTransport, Producer, Consumer };
export type { RtpCapabilities, RtpParameters, DtlsParameters, IceParameters, IceCandidate, TransportListenInfo };
