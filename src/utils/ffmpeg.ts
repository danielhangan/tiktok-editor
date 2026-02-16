import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '~/config/logger.js';
import type { GenerateVideoData } from '~/queue/index.js';

interface TextOptions {
  maxWidthPercent: number;
  fontSize: number;
  width: number;
}

function wrapText(text: string, options: TextOptions): string {
  const { maxWidthPercent, fontSize, width } = options;
  
  // Estimate characters per line based on video width, font size, and max width percent
  // Average character width is roughly 0.6 * fontSize for this font
  const avgCharWidth = fontSize * 0.55;
  const maxTextWidth = (width * maxWidthPercent) / 100;
  const maxCharsPerLine = Math.floor(maxTextWidth / avgCharWidth);
  const maxLines = 4;
  
  const words = text.split(' ');
  const lines: string[] = [''];

  words.forEach((word) => {
    // Handle very long words by breaking them
    if (word.length > maxCharsPerLine) {
      // If current line has content, start a new line
      if (lines[lines.length - 1].length > 0 && lines.length < maxLines) {
        lines.push('');
      }
      
      // Break the long word across lines
      let remaining = word;
      while (remaining.length > 0 && lines.length <= maxLines) {
        const currentLine = lines[lines.length - 1];
        const availableSpace = maxCharsPerLine - currentLine.length - (currentLine.length > 0 ? 1 : 0);
        
        if (availableSpace >= remaining.length || lines.length >= maxLines) {
          lines[lines.length - 1] = currentLine ? currentLine + ' ' + remaining : remaining;
          remaining = '';
        } else if (availableSpace > 3) {
          lines[lines.length - 1] = currentLine ? currentLine + ' ' + remaining.slice(0, availableSpace) : remaining.slice(0, availableSpace);
          remaining = remaining.slice(availableSpace);
          if (lines.length < maxLines) {
            lines.push('');
          }
        } else if (lines.length < maxLines) {
          lines.push('');
        } else {
          break;
        }
      }
      return;
    }
    
    const lastLine = lines[lines.length - 1];
    const testLine = lastLine ? lastLine + ' ' + word : word;
    
    if (testLine.length <= maxCharsPerLine) {
      lines[lines.length - 1] = testLine;
    } else if (lines.length < maxLines) {
      lines.push(word);
    }
    // If we're at max lines and can't fit, the word is dropped (truncated)
  });

  return lines.filter(line => line.length > 0).join('\\n');
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

function getTextXPosition(align: 'left' | 'center' | 'right', maxWidthPercent: number): string {
  const marginPercent = (100 - maxWidthPercent) / 2;
  
  switch (align) {
    case 'left':
      return `(w*${marginPercent / 100})`;
    case 'right':
      return `(w-text_w-(w*${marginPercent / 100}))`;
    case 'center':
    default:
      return '(w-text_w)/2';
  }
}

function getTextYPosition(position: 'top' | 'center' | 'bottom', height: number): string {
  switch (position) {
    case 'top':
      return `(h*0.15)`;
    case 'bottom':
      return `(h*0.75)`;
    case 'center':
    default:
      return '(h-text_h)/2';
  }
}

export async function generateTikTokVideo(data: GenerateVideoData): Promise<string> {
  const { 
    reactionPath, 
    demoPath, 
    hookText, 
    outputPath, 
    reactionDuration, 
    width, 
    height,
    textMaxWidthPercent = 60,
    textAlign = 'center',
    fontSize = 38,
    textPosition = 'center'
  } = data;

  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const tmpReaction = outputPath.replace('.mp4', '_tmp_reaction.mp4');
  const tmpDemo = outputPath.replace('.mp4', '_tmp_demo.mp4');
  const concatList = outputPath.replace('.mp4', '_concat.txt');

  const wrappedText = wrapText(hookText, { maxWidthPercent: textMaxWidthPercent, fontSize, width });
  const escapedText = escapeFFmpegText(wrappedText);
  
  const textX = getTextXPosition(textAlign, textMaxWidthPercent);
  const textY = getTextYPosition(textPosition, height);

  logger.debug({ 
    hookText, 
    wrappedText, 
    textMaxWidthPercent, 
    textAlign, 
    fontSize, 
    textPosition,
    textX,
    textY
  }, 'Text settings');

  try {
    // Step 1: Process reaction - scale, trim, add text overlay
    logger.debug({ tmpReaction }, 'Processing reaction');
    await runFFmpeg([
      '-y',
      '-i', reactionPath,
      '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo',
      '-filter_complex',
      `[0:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,trim=0:${reactionDuration},setpts=PTS-STARTPTS,drawtext=text='${escapedText}':fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:fontsize=${fontSize}:fontcolor=white:borderw=2:bordercolor=black:x=${textX}:y=${textY}[v]`,
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
