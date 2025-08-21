import { mkdir, stat } from 'fs/promises';
import path from 'path';
import { config } from './config.js';

export async function ensureStorageDir() {
  try {
    await stat(config.storageDir);
  } catch (err) {
    await mkdir(config.storageDir, { recursive: true });
  }
}

export function resolveStoragePath(filename) {
  return path.resolve(config.storageDir, filename);
}
