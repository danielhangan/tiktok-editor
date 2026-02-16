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

function getSessionDir(sessionId: string): string {
  // Sanitize sessionId to prevent directory traversal
  const safeSessionId = sessionId.replace(/[^a-zA-Z0-9-]/g, '');
  return path.join(env.DATA_DIR, 'sessions', safeSessionId);
}

function getDir(type: FileType, sessionId: string): string {
  return path.join(getSessionDir(sessionId), 'uploads', type);
}

function getOutputDir(sessionId: string): string {
  return path.join(getSessionDir(sessionId), 'output');
}

function getHooksPath(sessionId: string): string {
  return path.join(getSessionDir(sessionId), 'hooks.json');
}

export function ensureDirectories(): void {
  // Create base sessions directory
  const sessionsDir = path.join(env.DATA_DIR, 'sessions');
  if (!fs.existsSync(sessionsDir)) {
    fs.mkdirSync(sessionsDir, { recursive: true });
    logger.info({ dir: sessionsDir }, 'Created sessions directory');
  }
}

export function ensureSessionDirectories(sessionId: string): void {
  const dirs = [
    getDir('reactions', sessionId),
    getDir('demos', sessionId),
    getOutputDir(sessionId)
  ];

  dirs.forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      logger.debug({ dir }, 'Created session directory');
    }
  });
}

export function listFiles(type: FileType, sessionId: string): FileInfo[] {
  ensureSessionDirectories(sessionId);
  const dir = getDir(type, sessionId);
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
  file: File,
  sessionId: string
): Promise<FileInfo> {
  ensureSessionDirectories(sessionId);
  const dir = getDir(type, sessionId);
  const ext = path.extname(file.name);
  const id = randomUUID();
  const filename = `${id}${ext}`;
  const filePath = path.join(dir, filename);

  const buffer = await file.arrayBuffer();
  fs.writeFileSync(filePath, Buffer.from(buffer));

  const stats = fs.statSync(filePath);
  logger.info({ type, filename, size: stats.size, sessionId }, 'File saved');

  return {
    id,
    filename,
    originalName: file.name,
    path: filePath,
    size: stats.size,
    createdAt: new Date()
  };
}

export function deleteFile(type: FileType, id: string, sessionId: string): boolean {
  const dir = getDir(type, sessionId);
  if (!fs.existsSync(dir)) return false;
  
  const files = fs.readdirSync(dir);
  const file = files.find((f) => f.startsWith(id));

  if (file) {
    const filePath = path.join(dir, file);
    fs.unlinkSync(filePath);
    logger.info({ type, id, sessionId }, 'File deleted');
    return true;
  }

  return false;
}

export function getFile(type: FileType, id: string, sessionId: string): FileInfo | null {
  const files = listFiles(type, sessionId);
  return files.find((f) => f.id === id) || null;
}

export function listOutputs(sessionId: string): FileInfo[] {
  ensureSessionDirectories(sessionId);
  const dir = getOutputDir(sessionId);
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

export function getOutputPath(jobId: string, index: number, sessionId: string): string {
  ensureSessionDirectories(sessionId);
  return path.join(getOutputDir(sessionId), `tiktok_${jobId}_${index}.mp4`);
}

// Session-scoped hooks storage
export function getHooks(sessionId: string): string[] {
  const hooksPath = getHooksPath(sessionId);
  if (fs.existsSync(hooksPath)) {
    try {
      return JSON.parse(fs.readFileSync(hooksPath, 'utf-8'));
    } catch {
      return [];
    }
  }
  return [];
}

export function setHooks(sessionId: string, hooks: string[]): void {
  ensureSessionDirectories(sessionId);
  const hooksPath = getHooksPath(sessionId);
  fs.writeFileSync(hooksPath, JSON.stringify(hooks, null, 2));
  logger.info({ sessionId, count: hooks.length }, 'Hooks saved');
}

// Get output URL path for a session
export function getOutputUrlPath(filename: string, sessionId: string): string {
  return `/output/${sessionId}/${filename}`;
}
