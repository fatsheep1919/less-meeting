/**
 * 客户端信令消息类型（与服务端 src/types.ts 对齐）
 */

export interface PeerInfo {
  id: string;
  displayName: string;
}

export type ClientMessage =
  | { type: 'JOIN_ROOM'; roomId: string; passcode: string; displayName: string }
  | { type: 'LEAVE_ROOM' }
  | { type: 'CREATE_TRANSPORT'; direction: 'send' | 'recv' }
  | { type: 'CONNECT_TRANSPORT'; transportId: string; dtlsParameters: Record<string, unknown> }
  | { type: 'PRODUCE'; transportId: string; kind: 'audio' | 'video'; rtpParameters: Record<string, unknown> }
  | { type: 'CONSUME'; producerId: string; rtpCapabilities: Record<string, unknown> }
  | { type: 'MUTE' }
  | { type: 'UNMUTE' }
  | { type: 'CHAT'; text: string }
  | { type: 'SPEAKER_ACTIVE' }
  | { type: 'SPEAKER_INACTIVE' }
  | { type: 'STOP_SCREEN_SHARE' }
  | { type: 'PING' };

export type ServerMessage =
  | { type: 'ROOM_JOINED'; roomId: string; roomName: string; peerId: string; peers: PeerInfo[]; routerRtpCapabilities: Record<string, unknown> }
  | { type: 'PEER_JOINED'; peerId: string; displayName: string }
  | { type: 'PEER_LEFT'; peerId: string }
  | { type: 'TRANSPORT_CREATED'; transportId: string; iceParameters: Record<string, unknown>; iceCandidates: Record<string, unknown>[]; dtlsParameters: Record<string, unknown> }
  | { type: 'PRODUCER_CREATED'; producerId: string }
  | { type: 'NEW_CONSUMER'; peerId: string; consumerId: string; kind: 'audio' | 'video'; producerId: string; rtpParameters: Record<string, unknown> }
  | { type: 'SPEAKER_ACTIVE'; peerId: string }
  | { type: 'SPEAKER_INACTIVE'; peerId: string }
  | { type: 'SCREEN_SHARE_STOPPED'; peerId: string }
  | { type: 'CHAT'; peerId: string; displayName: string; text: string }
  | { type: 'ERROR'; code: string; message: string }
  | { type: 'PONG' };
