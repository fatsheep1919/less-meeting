import type { Room, Peer, PeerInfo } from '../types';
import { createRouter } from '../mediasoup/router';
import { generateRoomId, generatePasscode } from '../utils/passcode';
import { config } from '../config';

/**
 * 房间管理器 — 所有房间和参会者的状态都在内存中管理
 */
class RoomManager {
  private rooms = new Map<string, Room>();

  /**
   * 创建一个新房间
   * @param name 房间名称
   * @param passcode 房间口令（可选，不传则自动生成）
   * @returns 房间信息
   */
  async createRoom(name: string, passcode?: string): Promise<{ roomId: string; name: string; passcode: string }> {
    const router = await createRouter();
    const id = generateRoomId();
    const code = passcode || generatePasscode();

    const room: Room = {
      id,
      name,
      passcode: code,
      router,
      peers: new Map(),
      maxPeers: config.maxPeersPerRoom,
      createdAt: new Date(),
    };

    this.rooms.set(id, room);
    console.log(`[Room] 房间 "${name}" (${id}) 已创建`);

    return { roomId: id, name, passcode: code };
  }

  /**
   * 加入房间（验证口令）
   * @returns 房间对象，或错误信息
   */
  joinRoom(
    roomId: string,
    passcode: string,
    peerId: string,
    displayName: string,
    ws: import('ws').WebSocket
  ): { room: Room; peer: Peer } | { error: string; code: string } {
    const room = this.rooms.get(roomId);

    if (!room) {
      return { error: '房间不存在', code: 'ROOM_NOT_FOUND' };
    }

    if (room.passcode !== passcode) {
      return { error: '口令错误', code: 'WRONG_PASSCODE' };
    }

    if (room.peers.size >= room.maxPeers) {
      return { error: `房间已满（上限 ${room.maxPeers} 人）`, code: 'ROOM_FULL' };
    }

    // 同名检查
    for (const p of room.peers.values()) {
      if (p.displayName === displayName) {
        return { error: '该昵称已被使用', code: 'NAME_TAKEN' };
      }
    }

    const peer: Peer = {
      id: peerId,
      displayName,
      ws,
      consumers: new Map(),
      isMuted: false,
    };

    room.peers.set(peerId, peer);
    console.log(`[Room] ${displayName} (${peerId}) 加入房间 ${roomId}，当前 ${room.peers.size} 人`);

    return { room, peer };
  }

  /**
   * 离开房间
   */
  leaveRoom(roomId: string, peerId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const peer = room.peers.get(peerId);
    if (!peer) return;

    // 清理该 Peer 的所有 mediasoup 资源
    this.cleanupPeer(peer);

    room.peers.delete(peerId);
    console.log(`[Room] ${peer.displayName} 离开房间 ${roomId}，剩余 ${room.peers.size} 人`);

    // 空房间则关闭 Router 并删除
    if (room.peers.size === 0) {
      room.router.close();
      this.rooms.delete(roomId);
      console.log(`[Room] 房间 ${roomId} 已关闭（无参会者）`);
    }
  }

  /**
   * 获取房间
   */
  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  /**
   * 获取房间内的 Peer
   */
  getPeer(roomId: string, peerId: string): Peer | undefined {
    return this.rooms.get(roomId)?.peers.get(peerId);
  }

  /**
   * 获取房间所有成员的对外信息
   */
  getRoomPeersInfo(roomId: string): PeerInfo[] {
    const room = this.rooms.get(roomId);
    if (!room) return [];

    return Array.from(room.peers.values()).map((p) => ({
      id: p.id,
      displayName: p.displayName,
    }));
  }

  /**
   * 断开一个 Peer 的连接并清理资源
   */
  disconnectPeer(roomId: string, peerId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const peer = room.peers.get(peerId);
    if (!peer) return;

    // 关闭 WebSocket 连接
    try {
      peer.ws.close();
    } catch {
      // 可能已经关闭
    }

    this.leaveRoom(roomId, peerId);
  }

  /**
   * 获取所有房间数量
   */
  getRoomCount(): number {
    return this.rooms.size;
  }

  /**
   * 清理 Peer 的所有 mediasoup 资源
   */
  private cleanupPeer(peer: Peer): void {
    // 关闭所有 Consumer
    for (const consumer of peer.consumers.values()) {
      consumer.close();
    }
    peer.consumers.clear();

    // 关闭 Producer
    if (peer.producer) {
      peer.producer.close();
    }

    // 关闭 Transport
    if (peer.sendTransport) {
      peer.sendTransport.close();
    }
    if (peer.recvTransport) {
      peer.recvTransport.close();
    }
  }

  /**
   * 清理所有房间（进程退出时用）
   */
  async shutdown(): Promise<void> {
    for (const [roomId, room] of this.rooms) {
      for (const peer of room.peers.values()) {
        this.cleanupPeer(peer);
      }
      room.router.close();
    }
    this.rooms.clear();
    console.log('[Room] 所有房间已清理');
  }
}

// 全局单例
export const roomManager = new RoomManager();