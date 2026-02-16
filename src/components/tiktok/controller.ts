import type { OpenAPIHono } from '@hono/zod-openapi';
import { extractAudioRoute } from './schemas.js';
import { env } from '~/config/env.js';
import { logger } from '~/config/logger.js';
import { ensureSessionDirectories } from '~/utils/storage.js';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

const SCRAPECREATORS_API = 'https://api.scrapecreators.com/v2/tiktok/video';
const API_KEY = env.SCRAPECREATORS_API_KEY || 'Z5CXYvudpCavvlegnm0CS8jVuxc2';

interface TikTokVideoResponse {
  success: boolean;
  credits_remaining?: number;
  data?: {
    id: string;
    title?: string;
    description?: string;
    author?: {
      nickname?: string;
      uniqueId?: string;
    };
    music?: {
      title?: string;
      author?: string;
    };
    video?: {
      downloadAddr?: string;
      playAddr?: string;
    };
    downloadUrl?: string;
    playUrl?: string;
  };
  error?: string;
  message?: string;
}

async function downloadFile(url: string, destPath: string): Promise<void> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to download: ${response.status}`);
  }
  
  const buffer = await response.arrayBuffer();
  fs.writeFileSync(destPath, Buffer.from(buffer));
}

function extractAudioFFmpeg(videoPath: string, audioPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const process = spawn('ffmpeg', [
      '-y',
      '-i', videoPath,
      '-vn',                    // No video
      '-acodec', 'libmp3lame',  // MP3 codec
      '-ab', '192k',            // Bitrate
      '-ar', '44100',           // Sample rate
      audioPath
    ]);

    let stderr = '';
    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    process.on('close', (code) => {
      if (code !== 0) {
        logger.error({ code, stderr: stderr.slice(-500) }, 'FFmpeg audio extraction failed');
        reject(new Error(`FFmpeg exited with code ${code}`));
      } else {
        resolve();
      }
    });

    process.on('error', reject);
  });
}

export function registerTikTokRoutes(app: OpenAPIHono) {
  app.openapi(extractAudioRoute, async (c) => {
    const sessionId = c.req.header('x-session-id') || 'default';
    const { url } = c.req.valid('json');

    logger.info({ url, sessionId }, 'Extracting audio from TikTok');

    try {
      // 1. Call Scrapecreators API
      const apiUrl = `${SCRAPECREATORS_API}?url=${encodeURIComponent(url)}`;
      const response = await fetch(apiUrl, {
        headers: {
          'x-api-key': API_KEY
        }
      });

      const data: TikTokVideoResponse = await response.json();
      
      if (!data.success || !data.data) {
        logger.error({ data }, 'Scrapecreators API error');
        return c.json({ 
          error: 'Failed to fetch TikTok video',
          message: data.message || data.error || 'Video not found'
        }, 400);
      }

      // 2. Get download URL
      const videoUrl = data.data.downloadUrl || 
                       data.data.playUrl || 
                       data.data.video?.downloadAddr || 
                       data.data.video?.playAddr;

      if (!videoUrl) {
        return c.json({ 
          error: 'No download URL found',
          message: 'Could not get video download link'
        }, 400);
      }

      // 3. Setup paths
      ensureSessionDirectories(sessionId);
      const safeSessionId = sessionId.replace(/[^a-zA-Z0-9-]/g, '');
      const musicDir = path.join(env.DATA_DIR, 'sessions', safeSessionId, 'uploads', 'music');
      
      const id = randomUUID();
      const tmpVideoPath = path.join('/tmp', `tiktok_${id}.mp4`);
      
      // Generate filename from music info or video title
      const musicTitle = data.data.music?.title || data.data.title || 'tiktok_sound';
      const musicAuthor = data.data.music?.author || data.data.author?.nickname || '';
      const safeTitle = musicTitle.replace(/[^a-zA-Z0-9\s-]/g, '').slice(0, 50).trim();
      const filename = `${safeTitle}_${id.slice(0, 8)}.mp3`;
      const audioPath = path.join(musicDir, filename);

      // 4. Download video
      logger.debug({ videoUrl, tmpVideoPath }, 'Downloading TikTok video');
      await downloadFile(videoUrl, tmpVideoPath);

      // 5. Extract audio
      logger.debug({ tmpVideoPath, audioPath }, 'Extracting audio');
      await extractAudioFFmpeg(tmpVideoPath, audioPath);

      // 6. Cleanup temp video
      try {
        fs.unlinkSync(tmpVideoPath);
      } catch {
        // Ignore cleanup errors
      }

      // 7. Verify audio file exists
      if (!fs.existsSync(audioPath)) {
        return c.json({ 
          error: 'Audio extraction failed',
          message: 'Could not extract audio from video'
        }, 500);
      }

      logger.info({ 
        musicId: id, 
        filename, 
        title: musicTitle,
        author: musicAuthor,
        sessionId 
      }, 'Audio extracted successfully');

      return c.json({
        success: true,
        musicId: id,
        filename,
        title: musicTitle,
        author: musicAuthor
      });

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error({ error: message, url }, 'TikTok extraction failed');
      return c.json({ 
        error: 'Extraction failed',
        message 
      }, 500);
    }
  });
}
