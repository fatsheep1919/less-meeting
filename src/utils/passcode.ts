import { config } from '../config';

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 去掉容易混淆的 0/O/1/I

/**
 * 生成一个指定长度的随机口令
 */
export function generatePasscode(length: number = config.passcodeLength): string {
  let result = '';
  const buf = new Uint32Array(length);
  crypto.getRandomValues(buf);
  for (let i = 0; i < length; i++) {
    result += CHARS[buf[i] % CHARS.length];
  }
  return result;
}

/**
 * 生成 6 位随机房间 ID
 */
export function generateRoomId(): string {
  return generatePasscode(6);
}
