import type { OpenAPIHono } from '@hono/zod-openapi';
import { extractAudioRoute } from './schemas.js';
import { env } from '~/config/env.js';
import { logger } from '~/config/logger.js';
import { ensureSessionDirectories } from '~/utils/storage.js';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

const SCRAPECREATORS_API = 'https://api.scrapecreators.com/v2/tiktok/video';
const API_KEY = env.SCRAPECREATORS_API_KEY;

interface TikTokResponse {
  success: boolean;
  credits_remaining?: number;
  aweme_detail?: {
    desc?: string;
    music?: {
      title?: string;
      author?: string;
      play_url?: {
        url_list?: string[];
        uri?: string;
      };
    };
    author?: {
      nickname?: string;
      unique_id?: string;
    };
  };
  error?: string;
  message?: string;
}

async function downloadFile(url: string, destPath: string): Promise<void> {
  logger.debug({ url: url.slice(0, 100) + '...' }, 'Downloading file');
  
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': 'https://www.tiktok.com/'
    }
  });
  
  if (!response.ok) {
    throw new Error(`Download failed: ${response.status} ${response.statusText}`);
  }
  
  const buffer = await response.arrayBuffer();
  fs.writeFileSync(destPath, Buffer.from(buffer));
  logger.debug({ destPath, size: buffer.byteLength }, 'File downloaded');
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

      const data: TikTokResponse = await response.json();
      
      logger.debug({ 
        success: data.success,
        hasAwemeDetail: !!data.aweme_detail,
        hasMusic: !!data.aweme_detail?.music,
        hasMusicUrl: !!data.aweme_detail?.music?.play_url?.url_list?.[0]
      }, 'TikTok API response');

      if (!data.success) {
        logger.error({ error: data.error, message: data.message }, 'Scrapecreators API error');
        return c.json({ 
          error: 'Failed to fetch TikTok video',
          message: data.message || data.error || 'Video not found'
        }, 400);
      }

      const aweme = data.aweme_detail;
      if (!aweme) {
        return c.json({ 
          error: 'Invalid response',
          message: 'No video details in API response'
        }, 400);
      }

      // 2. Get music URL directly (it's already an MP3!)
      const musicUrl = aweme.music?.play_url?.url_list?.[0] || aweme.music?.play_url?.uri;

      if (!musicUrl) {
        logger.error({ music: aweme.music }, 'No music URL found');
        return c.json({ 
          error: 'No music URL found',
          message: 'Could not find audio in this TikTok'
        }, 400);
      }

      logger.info({ musicUrl: musicUrl.slice(0, 80) + '...' }, 'Found music URL');

      // 3. Setup paths
      ensureSessionDirectories(sessionId);
      const safeSessionId = sessionId.replace(/[^a-zA-Z0-9-]/g, '');
      const musicDir = path.join(env.DATA_DIR, 'sessions', safeSessionId, 'uploads', 'music');
      
      const id = randomUUID();
      
      // Generate filename from music info
      const musicTitle = aweme.music?.title || aweme.desc || 'tiktok_sound';
      const musicAuthor = aweme.music?.author || aweme.author?.nickname || '';
      const safeTitle = musicTitle.replace(/[^a-zA-Z0-9\s-]/g, '').slice(0, 50).trim() || 'tiktok_sound';
      const filename = `${safeTitle}_${id.slice(0, 8)}.mp3`;
      const audioPath = path.join(musicDir, filename);

      // 4. Download the MP3 directly
      logger.debug({ musicUrl, audioPath }, 'Downloading music');
      await downloadFile(musicUrl, audioPath);

      // 5. Verify file exists
      if (!fs.existsSync(audioPath)) {
        return c.json({ 
          error: 'Download failed',
          message: 'Could not save audio file'
        }, 500);
      }

      const stats = fs.statSync(audioPath);
      logger.info({ 
        musicId: id, 
        filename, 
        title: musicTitle,
        author: musicAuthor,
        size: stats.size,
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
