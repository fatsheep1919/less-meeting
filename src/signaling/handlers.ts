import { randomUUID } from 'crypto';
import { WebSocket, WebSocketServer } from 'ws';
import type { Room, Peer, Producer } from '../types';
import type { ClientMessage, ServerMessage } from '../types';
import { roomManager } from '../room/RoomManager';
import { getTransportConfig } from '../mediasoup/config';
import { config } from '../config';

/**
 * 创建 WebSocket 服务
 */
export function createWSServer(): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });

  wss.on('connection', (ws: WebSocket) => {
    // 为每个连接生成唯一 peerId
    const peerId = randomUUID();

    // 跟踪当前 Peer 所在的房间
    let currentRoomId: string | null = null;
    // 标记连接是否已通过口令验证（绑定到房间）
    let isAuthenticated = false;

    console.log(`[WS] 新连接: ${peerId}`);

    // 心跳检测
    let isAlive = true;
    const pingInterval = setInterval(() => {
      if (!isAlive) {
        clearInterval(pingInterval);
        handleDisconnect();
        return;
      }
      isAlive = false;
      try {
        ws.ping();
      } catch {
        handleDisconnect();
      }
    }, 30_000);

    ws.on('pong', () => {
      isAlive = true;
    });

    ws.on('message', (raw: Buffer) => {
      let msg: ClientMessage;

      try {
        msg = JSON.parse(raw.toString()) as ClientMessage;
      } catch {
        send(ws, { type: 'ERROR', code: 'PARSE_ERROR', message: '无法解析消息' });
        return;
      }

      handleMessage(msg, ws, peerId).catch((err) => {
        console.error(`[WS] 消息处理错误 (${peerId}):`, err);
        send(ws, { type: 'ERROR', code: 'INTERNAL', message: '服务端内部错误' });
      });
    });

    ws.on('close', () => {
      clearInterval(pingInterval);
      handleDisconnect();
    });

    ws.on('error', (err) => {
      console.error(`[WS] 连接错误 (${peerId}):`, err.message);
      clearInterval(pingInterval);
      handleDisconnect();
    });

    /**
     * 处理断开连接
     */
    function handleDisconnect(): void {
      if (currentRoomId) {
        // 通知房间内其他成员
        const room = roomManager.getRoom(currentRoomId);
        if (room && room.peers.get(peerId)) {
          broadcastToRoom(room, { type: 'PEER_LEFT', peerId }, peerId);
          console.log(`[WS] ${peerId} 断开连接，离开房间 ${currentRoomId}`);
        }
        roomManager.leaveRoom(currentRoomId, peerId);
      }
    }

    /**
     * 消息分发
     */
    async function handleMessage(
      msg: ClientMessage,
      ws: WebSocket,
      peerId: string
    ): Promise<void> {
      switch (msg.type) {
        case 'PING':
          send(ws, { type: 'PONG' });
          return;

        // ---- 房间操作 ----

        case 'JOIN_ROOM': {
          // 如果已经在一个房间中，先退出
          if (currentRoomId) {
            roomManager.leaveRoom(currentRoomId, peerId);
            currentRoomId = null;
            isAuthenticated = false;
          }

          const result = roomManager.joinRoom(
            msg.roomId,
            msg.passcode,
            peerId,
            msg.displayName,
            ws
          );

          if ('code' in result) {
            send(ws, { type: 'ERROR', code: result.code, message: result.error });
            return;
          }

          const { room } = result;

          currentRoomId = room.id;
          isAuthenticated = true;

          // 通知本人加入成功
          send(ws, {
            type: 'ROOM_JOINED',
            roomId: room.id,
            roomName: room.name,
            peerId,
            peers: roomManager.getRoomPeersInfo(room.id),
            routerRtpCapabilities: room.router.rtpCapabilities,
          });

          // 通知其他人
          broadcastToRoom(room, {
            type: 'PEER_JOINED',
            peerId,
            displayName: msg.displayName,
          }, peerId);

          return;
        }

        case 'LEAVE_ROOM': {
          if (!currentRoomId) return;

          const room = roomManager.getRoom(currentRoomId);
          if (room) {
            broadcastToRoom(room, { type: 'PEER_LEFT', peerId }, peerId);
          }

          roomManager.leaveRoom(currentRoomId, peerId);
          currentRoomId = null;
          isAuthenticated = false;
          return;
        }

        case 'CHAT': {
          if (!currentRoomId || !isAuthenticated) {
            send(ws, { type: 'ERROR', code: 'NOT_IN_ROOM', message: '请先加入房间' });
            return;
          }
          const room = roomManager.getRoom(currentRoomId);
          if (!room) return;
          const peer = room.peers.get(peerId);
          if (!peer) return;

          broadcastToRoom(room, {
            type: 'CHAT',
            peerId,
            displayName: peer.displayName,
            text: msg.text,
          });
          return;
        }

        // ---- WebRTC / Mediasoup 操作 ----

        case 'CREATE_TRANSPORT': {
          if (!currentRoomId || !isAuthenticated) {
            send(ws, { type: 'ERROR', code: 'NOT_IN_ROOM', message: '请先加入房间' });
            return;
          }
          await handleCreateTransport(msg, ws, peerId, currentRoomId);
          return;
        }

        case 'CONNECT_TRANSPORT': {
          if (!currentRoomId || !isAuthenticated) return;
          await handleConnectTransport(msg, ws, peerId, currentRoomId);
          return;
        }

        case 'PRODUCE': {
          if (!currentRoomId || !isAuthenticated) return;
          await handleProduce(msg, ws, peerId, currentRoomId);
          return;
        }

        case 'CONSUME': {
          if (!currentRoomId || !isAuthenticated) return;
          await handleConsume(msg, ws, peerId, currentRoomId);
          return;
        }

        case 'STOP_SCREEN_SHARE': {
          if (!currentRoomId || !isAuthenticated) return;
          const room = roomManager.getRoom(currentRoomId);
          if (room) {
            broadcastToRoom(room, {
              type: 'SCREEN_SHARE_STOPPED',
              peerId,
            }, peerId);
          }
          return;
        }

        case 'SPEAKER_ACTIVE':
        case 'SPEAKER_INACTIVE': {
          if (!currentRoomId || !isAuthenticated) return;
          const room = roomManager.getRoom(currentRoomId);
          if (room) {
            broadcastToRoom(room, {
              type: msg.type,
              peerId,
            }, peerId);
          }
          return;
        }

        case 'MUTE':
        case 'UNMUTE': {
          if (!currentRoomId || !isAuthenticated) return;
          const peer = roomManager.getPeer(currentRoomId, peerId);
          if (peer) {
            peer.isMuted = msg.type === 'MUTE';
            const audioProducer = peer.producers.get('audio');
            if (audioProducer) {
              try {
                if (peer.isMuted) {
                  await audioProducer.pause();
                } else {
                  await audioProducer.resume();
                }
              } catch {
                // 忽略
              }
            }
          }
          return;
        }

        default:
          send(ws, { type: 'ERROR', code: 'UNKNOWN_TYPE', message: `未知消息类型: ${(msg as any).type}` });
      }
    }
  });

  console.log(`[WS] WebSocket 服务已就绪`);
  return wss;
}

// ============================================
// Mediasoup 操作处理函数
// ============================================

async function handleCreateTransport(
  msg: Extract<ClientMessage, { type: 'CREATE_TRANSPORT' }>,
  ws: WebSocket,
  peerId: string,
  roomId: string
): Promise<void> {
  const room = roomManager.getRoom(roomId);
  const peer = room?.peers.get(peerId);
  if (!room || !peer) return;

  const transport = await room.router.createWebRtcTransport(getTransportConfig());

  // 设置最大上行比特率
  await transport.setMaxIncomingBitrate(config.transport.maxIncomeBitrate);

  transport.on('dtlsstatechange', (dtlsState) => {
    if (dtlsState === 'closed' || dtlsState === 'failed') {
      transport.close();
    }
  });

  // 按方向存储 Transport
  const isSend = msg.direction === 'send';
  if (isSend) {
    peer.sendTransport?.close();
    peer.sendTransport = transport;
  } else {
    peer.recvTransport?.close();
    peer.recvTransport = transport;
  }

  send(ws, {
    type: 'TRANSPORT_CREATED',
    transportId: transport.id,
    iceParameters: transport.iceParameters,
    iceCandidates: transport.iceCandidates,
    dtlsParameters: transport.dtlsParameters,
  });

  // 立即尝试为新人订阅已有流（先 connect，后补）
  if (!isSend) {
    for (const [otherId, otherPeer] of room.peers) {
      if (otherId === peerId) continue;
      for (const producer of otherPeer.producers.values()) {
        createConsumerForPeer(room, peer, producer, otherId);
      }
    }
  }
}

async function handleConnectTransport(
  msg: Extract<ClientMessage, { type: 'CONNECT_TRANSPORT' }>,
  _ws: WebSocket,
  peerId: string,
  roomId: string
): Promise<void> {
  const peer = roomManager.getPeer(roomId, peerId);
  if (!peer) return;

  const transport = peer.sendTransport?.id === msg.transportId
    ? peer.sendTransport
    : peer.recvTransport;

  if (!transport) return;

  try {
    await transport.connect({ dtlsParameters: msg.dtlsParameters });
  } catch (err) {
    console.error(`[WS] Transport connect 失败 (${peerId}):`, err);
  }
}

async function handleProduce(
  msg: Extract<ClientMessage, { type: 'PRODUCE' }>,
  ws: WebSocket,
  peerId: string,
  roomId: string
): Promise<void> {
  const peer = roomManager.getPeer(roomId, peerId);
  if (!peer || !peer.sendTransport) return;

  try {
    const producer = await peer.sendTransport.produce({
      kind: msg.kind,
      rtpParameters: msg.rtpParameters,
      appData: { peerId },   // 存储 Producer 所属者的 peerId
    });

    // 关闭同类型旧 Producer，存储新 Producer
    const existing = peer.producers.get(msg.kind);
    if (existing) existing.close();
    peer.producers.set(msg.kind, producer);

    send(ws, { type: 'PRODUCER_CREATED', producerId: producer.id });

    // 通知房间内其他人有新 Producer
    const room = roomManager.getRoom(roomId);
    if (room) {
      for (const [otherId, otherPeer] of room.peers) {
        if (otherId === peerId) continue;

        // 为每个其他人创建 Consumer
        createConsumerForPeer(room, otherPeer, producer, peerId);
      }
    }
  } catch (err) {
    console.error(`[WS] Produce 失败 (${peerId}):`, err);
    send(ws, { type: 'ERROR', code: 'PRODUCE_FAILED', message: '创建媒体流失败' });
  }
}

async function handleConsume(
  msg: Extract<ClientMessage, { type: 'CONSUME' }>,
  ws: WebSocket,
  peerId: string,
  roomId: string
): Promise<void> {
  const peer = roomManager.getPeer(roomId, peerId);
  if (!peer || !peer.recvTransport) return;

  const room = roomManager.getRoom(roomId);
  if (!room) return;

  // 找到对应的 Producer（遍历房间内其他人的所有 Producer）
  for (const [otherId, otherPeer] of room.peers) {
    if (otherId === peerId) continue;
    for (const producer of otherPeer.producers.values()) {
      if (producer.id === msg.producerId) {
        await createConsumerForPeer(room, peer, producer, otherId);
        return;
      }
    }
  }

  // 如果直接返回 404 会导致客户端重试风暴
  // 这里静默处理 — 可能是 Producer 已经关闭但客户端还没收到通知
}

// ============================================
// Consumer 创建
// ============================================

async function createConsumerForPeer(
  room: Room,
  peer: Peer,
  producer: Producer,
  producerOwnerId: string,   // Producer 所属者的 peerId
): Promise<void> {
  // 检查是否已存在该 Producer 的 Consumer
  for (const existing of peer.consumers.values()) {
    if (existing.producerId === producer.id) return;
  }

  const transport = peer.recvTransport;
  if (!transport) return;

  // 检查 Consumer 数量限制（每个 Peer 最多订阅 (N-1)*2 条流，含音频+视频）
  if (peer.consumers.size >= (config.maxPeersPerRoom - 1) * 2) {
    console.warn(`[WS] ${peer.displayName} Consumer 数量已达上限`);
    return;
  }

  try {
    const consumer = await transport.consume({
      producerId: producer.id,
      rtpCapabilities: room.router.rtpCapabilities,
      paused: false,   // 不自动暂停
    });

    peer.consumers.set(consumer.id, consumer);

    send(peer.ws, {
      type: 'NEW_CONSUMER',
      peerId: producerOwnerId,                // Producer 所属者的 peerId（用于前端音频绑定）
      consumerId: consumer.id,
      kind: consumer.kind as 'audio' | 'video',
      producerId: producer.id,
      rtpParameters: consumer.rtpParameters,
    });

    console.log(`[WS] Consumer 已创建: ${peer.displayName} ← ${producer.id}`);
  } catch (err) {
    console.error(`[WS] Consumer 创建失败:`, err);
  }
}

// ============================================
// 工具函数
// ============================================

/**
 * 向单个 WebSocket 发送消息
 */
function send(ws: WebSocket, msg: ServerMessage): void {
  if (ws.readyState !== WebSocket.OPEN) return;
  try {
    ws.send(JSON.stringify(msg));
  } catch {
    // 连接已关闭
  }
}

/**
 * 向房间内所有成员广播消息（可选排除某个人）
 */
function broadcastToRoom(room: Room, msg: ServerMessage, excludePeerId?: string): void {
  for (const [id, peer] of room.peers) {
    if (excludePeerId && id === excludePeerId) continue;
    send(peer.ws, msg);
  }
}