import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '~/config/logger.js';
import type { GenerateVideoData } from '~/queue/index.js';

function wrapText(text: string, maxChars = 30, maxLines = 4): string {
  const words = text.split(' ');
  const lines: string[] = [''];

  words.forEach((word) => {
    const lastLine = lines[lines.length - 1];
    if ((lastLine + ' ' + word).length <= maxChars) {
      lines[lines.length - 1] = lastLine ? lastLine + ' ' + word : word;
    } else if (lines.length < maxLines) {
      lines.push(word);
    }
  });

  return lines.join('\\n');
}

function escapeFFmpegText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "'\\''")
    .replace(/:/g, '\\:')
    .replace(/\n/g, '\\n');
}

function runFFmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const process = spawn('ffmpeg', args);

    let stderr = '';
    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    process.on('close', (code) => {
      if (code !== 0) {
        logger.error({ code, stderr: stderr.slice(-500) }, 'FFmpeg failed');
        reject(new Error(`FFmpeg exited with code ${code}`));
      } else {
        resolve();
      }
    });

    process.on('error', (err) => {
      reject(err);
    });
  });
}

export async function generateTikTokVideo(data: GenerateVideoData): Promise<string> {
  const { reactionPath, demoPath, hookText, outputPath, reactionDuration, width, height } = data;

  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const tmpReaction = outputPath.replace('.mp4', '_tmp_reaction.mp4');
  const tmpDemo = outputPath.replace('.mp4', '_tmp_demo.mp4');
  const concatList = outputPath.replace('.mp4', '_concat.txt');

  const wrappedText = wrapText(hookText);
  const escapedText = escapeFFmpegText(wrappedText);

  try {
    // Step 1: Process reaction - scale, trim, add text overlay
    logger.debug({ tmpReaction }, 'Processing reaction');
    await runFFmpeg([
      '-y',
      '-i', reactionPath,
      '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo',
      '-filter_complex',
      `[0:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,trim=0:${reactionDuration},setpts=PTS-STARTPTS,drawtext=text='${escapedText}':fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:fontsize=38:fontcolor=white:borderw=2:bordercolor=black:x=(w-text_w)/2:y=(h-text_h)/2-50[v]`,
      '-map', '[v]', '-map', '1:a',
      '-t', String(reactionDuration),
      '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
      '-c:a', 'aac', '-b:a', '128k', '-shortest',
      tmpReaction
    ]);

    // Step 2: Process demo - scale to match
    logger.debug({ tmpDemo }, 'Processing demo');
    await runFFmpeg([
      '-y',
      '-i', demoPath,
      '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo',
      '-filter_complex',
      `[0:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2[v]`,
      '-map', '[v]', '-map', '1:a',
      '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
      '-c:a', 'aac', '-b:a', '128k', '-shortest',
      tmpDemo
    ]);

    // Step 3: Concatenate
    logger.debug({ outputPath }, 'Concatenating videos');
    fs.writeFileSync(concatList, `file '${path.resolve(tmpReaction)}'\nfile '${path.resolve(tmpDemo)}'`);

    await runFFmpeg([
      '-y',
      '-f', 'concat', '-safe', '0', '-i', concatList,
      '-c', 'copy',
      outputPath
    ]);

    logger.info({ outputPath }, 'Video generated successfully');
    return outputPath;
  } finally {
    // Cleanup temp files
    [tmpReaction, tmpDemo, concatList].forEach((f) => {
      if (fs.existsSync(f)) {
        try {
          fs.unlinkSync(f);
        } catch {
          // Ignore cleanup errors
        }
      }
    });
  }
}
