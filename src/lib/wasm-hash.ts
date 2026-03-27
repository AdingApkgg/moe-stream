/**
 * WASM 加速的哈希工具（基于 hash-wasm）
 *
 * 统一项目中所有哈希操作，利用 WASM 在客户端和服务端均可高效运行。
 * hash-wasm 使用 WebAssembly 实现，首次调用会加载 WASM 模块并缓存，
 * 后续调用几乎零开销。
 */
import { md5 as wasmMd5, sha256 as wasmSha256, createHMAC, createSHA256 } from "hash-wasm";

export async function md5(input: string): Promise<string> {
  return wasmMd5(input);
}

export async function sha256(input: string): Promise<string> {
  return wasmSha256(input);
}

export async function hmacSha256(key: string, data: string): Promise<string> {
  const hmac = await createHMAC(createSHA256(), key);
  hmac.update(data);
  return hmac.digest("hex");
}
