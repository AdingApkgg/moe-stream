import { createSHA256 } from "hash-wasm";

const CHUNK_SIZE = 2 * 1024 * 1024; // 2MB per read for hashing

/**
 * Compute SHA-256 hash of a File using streaming (hash-wasm WebAssembly).
 * Reads in 2MB chunks to avoid loading the entire file into memory.
 */
export async function computeSHA256(
  file: File,
  onProgress?: (percent: number) => void,
  signal?: AbortSignal,
): Promise<string> {
  const hasher = await createSHA256();
  hasher.init();

  const total = file.size;
  let offset = 0;

  while (offset < total) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

    const end = Math.min(offset + CHUNK_SIZE, total);
    const slice = file.slice(offset, end);
    const buffer = await slice.arrayBuffer();
    hasher.update(new Uint8Array(buffer));

    offset = end;
    onProgress?.(Math.round((offset / total) * 100));
  }

  return hasher.digest("hex");
}
