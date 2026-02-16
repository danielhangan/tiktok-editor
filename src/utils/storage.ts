import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { env } from '~/config/env.js';
import { logger } from '~/config/logger.js';

export interface FileInfo {
  id: string;
  filename: string;
  originalName: string;
  path: string;
  size: number;
  createdAt: Date;
}

export type FileType = 'reactions' | 'demos';

const VALID_EXTENSIONS = ['.mp4', '.mov', '.MOV', '.avi', '.webm'];

function getDir(type: FileType): string {
  return path.join(env.DATA_DIR, 'uploads', type);
}

function getOutputDir(): string {
  return path.join(env.DATA_DIR, 'output');
}

export function ensureDirectories(): void {
  const dirs = [
    getDir('reactions'),
    getDir('demos'),
    getOutputDir()
  ];

  dirs.forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      logger.info({ dir }, 'Created directory');
    }
  });
}

export function listFiles(type: FileType): FileInfo[] {
  const dir = getDir(type);
  if (!fs.existsSync(dir)) return [];

  return fs
    .readdirSync(dir)
    .filter((f) => VALID_EXTENSIONS.some((ext) => f.toLowerCase().endsWith(ext.toLowerCase())))
    .map((filename) => {
      const filePath = path.join(dir, filename);
      const stats = fs.statSync(filePath);
      return {
        id: filename.split('.')[0],
        filename,
        originalName: filename,
        path: filePath,
        size: stats.size,
        createdAt: stats.birthtime
      };
    });
}

export async function saveFile(
  type: FileType,
  file: File
): Promise<FileInfo> {
  const dir = getDir(type);
  const ext = path.extname(file.name);
  const id = randomUUID();
  const filename = `${id}${ext}`;
  const filePath = path.join(dir, filename);

  const buffer = await file.arrayBuffer();
  fs.writeFileSync(filePath, Buffer.from(buffer));

  const stats = fs.statSync(filePath);
  logger.info({ type, filename, size: stats.size }, 'File saved');

  return {
    id,
    filename,
    originalName: file.name,
    path: filePath,
    size: stats.size,
    createdAt: new Date()
  };
}

export function deleteFile(type: FileType, id: string): boolean {
  const dir = getDir(type);
  const files = fs.readdirSync(dir);
  const file = files.find((f) => f.startsWith(id));

  if (file) {
    const filePath = path.join(dir, file);
    fs.unlinkSync(filePath);
    logger.info({ type, id }, 'File deleted');
    return true;
  }

  return false;
}

export function getFile(type: FileType, id: string): FileInfo | null {
  const files = listFiles(type);
  return files.find((f) => f.id === id) || null;
}

export function listOutputs(): FileInfo[] {
  const dir = getOutputDir();
  if (!fs.existsSync(dir)) return [];

  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.mp4'))
    .map((filename) => {
      const filePath = path.join(dir, filename);
      const stats = fs.statSync(filePath);
      return {
        id: filename.replace('.mp4', ''),
        filename,
        originalName: filename,
        path: filePath,
        size: stats.size,
        createdAt: stats.birthtime
      };
    });
}

export function getOutputPath(jobId: string, index: number): string {
  return path.join(getOutputDir(), `tiktok_${jobId}_${index}.mp4`);
}
