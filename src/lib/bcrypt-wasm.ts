/**
 * WASM 加速的 bcrypt 实现（基于 hash-wasm）
 * API 与 bcryptjs 兼容，可直接替换；哈希格式与 bcrypt 标准一致，与现有数据库中的密码兼容。
 */
import { bcrypt as wasmBcrypt, bcryptVerify } from "hash-wasm";
import { randomBytes } from "crypto";

/**
 * 使用 WASM 计算 bcrypt 哈希（兼容 bcryptjs 的 hash(password, rounds)）
 */
export async function hash(password: string, rounds: number): Promise<string> {
  const salt = randomBytes(16);
  return wasmBcrypt({
    password,
    salt,
    costFactor: rounds,
    outputType: "encoded",
  });
}

/**
 * 使用 WASM 验证密码与哈希是否匹配（兼容 bcryptjs 的 compare(password, hash)）
 */
export async function compare(password: string, hashStr: string): Promise<boolean> {
  return bcryptVerify({ password, hash: hashStr });
}
