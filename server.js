const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const uuidv4 = () => crypto.randomUUID();
const { spawn } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3456;

// Use persistent volume in production, local in dev
const DATA_DIR = process.env.RAILWAY_VOLUME_MOUNT_PATH || '.';
const UPLOADS_DIR = `${DATA_DIR}/uploads`;
const OUTPUT_DIR = `${DATA_DIR}/output`;

// Ensure directories exist
[`${UPLOADS_DIR}/reactions`, `${UPLOADS_DIR}/demos`, OUTPUT_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/output', express.static(OUTPUT_DIR));
app.use('/uploads', express.static(UPLOADS_DIR));

// Health check for Railway
app.get('/health', (req, res) => res.status(200).send('OK'));

// Storage config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const type = req.params.type; // 'reactions' or 'demos'
    cb(null, `${UPLOADS_DIR}/${type}`);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 500 * 1024 * 1024 } // 500MB limit
});

// Store state in memory (could use Redis/DB for production)
const state = {
  reactions: [],
  demos: [],
  hooks: [],
  jobs: []
};

// Load existing files on startup
function loadExistingFiles() {
  ['reactions', 'demos'].forEach(type => {
    const dir = `${UPLOADS_DIR}/${type}`;
    if (fs.existsSync(dir)) {
      const files = fs.readdirSync(dir).filter(f => /\.(mp4|mov|MOV)$/i.test(f));
      state[type] = files.map(f => ({
        id: uuidv4(),
        filename: f,
        path: `${UPLOADS_DIR}/${type}/${f}`,
        originalName: f
      }));
    }
  });
}
loadExistingFiles();

// Upload endpoint
app.post('/api/upload/:type', upload.array('files', 50), (req, res) => {
  const type = req.params.type;
  if (!['reactions', 'demos'].includes(type)) {
    return res.status(400).json({ error: 'Invalid type' });
  }
  
  const uploaded = req.files.map(f => ({
    id: uuidv4(),
    filename: f.filename,
    path: f.path,
    originalName: f.originalname
  }));
  
  state[type].push(...uploaded);
  res.json({ success: true, files: uploaded });
});

// Get files
app.get('/api/files/:type', (req, res) => {
  const type = req.params.type;
  res.json(state[type] || []);
});

// Delete file
app.delete('/api/files/:type/:id', (req, res) => {
  const { type, id } = req.params;
  const idx = state[type].findIndex(f => f.id === id);
  if (idx > -1) {
    const file = state[type][idx];
    if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
    state[type].splice(idx, 1);
  }
  res.json({ success: true });
});

// Set hooks
app.post('/api/hooks', (req, res) => {
  state.hooks = req.body.hooks || [];
  res.json({ success: true, count: state.hooks.length });
});

app.get('/api/hooks', (req, res) => {
  res.json(state.hooks);
});

// FFmpeg video processing
function createVideo(reaction, demo, hookText, outputPath) {
  return new Promise((resolve, reject) => {
    // Escape text for ffmpeg
    const escapedText = hookText
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "'\\''")
      .replace(/:/g, '\\:')
      .replace(/\n/g, '\\n');
    
    // Wrap text (30 chars per line, max 4 lines)
    const words = escapedText.split(' ');
    let lines = [''];
    words.forEach(word => {
      const lastLine = lines[lines.length - 1];
      if ((lastLine + ' ' + word).length <= 30) {
        lines[lines.length - 1] = lastLine ? lastLine + ' ' + word : word;
      } else {
        if (lines.length < 4) lines.push(word);
      }
    });
    const wrappedText = lines.join('\\n');
    
    const tmpReaction = outputPath.replace('.mp4', '_tmp_reaction.mp4');
    const tmpDemo = outputPath.replace('.mp4', '_tmp_demo.mp4');
    const concatList = outputPath.replace('.mp4', '_concat.txt');
    
    // Step 1: Process reaction
    const cmd1 = spawn('ffmpeg', [
      '-y', '-i', reaction.path,
      '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo',
      '-filter_complex',
      `[0:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,trim=0:4.5,setpts=PTS-STARTPTS,drawtext=text='${wrappedText}':fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:fontsize=38:fontcolor=white:borderw=2:bordercolor=black:x=(w-text_w)/2:y=(h-text_h)/2-50[v]`,
      '-map', '[v]', '-map', '1:a',
      '-t', '4.5',
      '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
      '-c:a', 'aac', '-b:a', '128k', '-shortest',
      tmpReaction
    ]);
    
    cmd1.on('close', (code1) => {
      if (code1 !== 0) return reject(new Error('Reaction processing failed'));
      
      // Step 2: Process demo
      const cmd2 = spawn('ffmpeg', [
        '-y', '-i', demo.path,
        '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo',
        '-filter_complex',
        '[0:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2[v]',
        '-map', '[v]', '-map', '1:a',
        '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
        '-c:a', 'aac', '-b:a', '128k', '-shortest',
        tmpDemo
      ]);
      
      cmd2.on('close', (code2) => {
        if (code2 !== 0) return reject(new Error('Demo processing failed'));
        
        // Step 3: Concat
        fs.writeFileSync(concatList, `file '${path.resolve(tmpReaction)}'\nfile '${path.resolve(tmpDemo)}'`);
        
        const cmd3 = spawn('ffmpeg', [
          '-y', '-f', 'concat', '-safe', '0', '-i', concatList,
          '-c', 'copy', outputPath
        ]);
        
        cmd3.on('close', (code3) => {
          // Cleanup
          [tmpReaction, tmpDemo, concatList].forEach(f => {
            if (fs.existsSync(f)) fs.unlinkSync(f);
          });
          
          if (code3 !== 0) return reject(new Error('Concat failed'));
          resolve(outputPath);
        });
      });
    });
  });
}

// Generate videos
app.post('/api/generate', async (req, res) => {
  const { combinations } = req.body;
  // combinations: [{ reactionId, demoId, hookIndex }]
  
  if (!combinations || !combinations.length) {
    return res.status(400).json({ error: 'No combinations specified' });
  }
  
  const jobId = uuidv4();
  const job = {
    id: jobId,
    status: 'processing',
    total: combinations.length,
    completed: 0,
    outputs: [],
    errors: []
  };
  state.jobs.push(job);
  
  res.json({ jobId, status: 'started' });
  
  // Process in background
  for (const combo of combinations) {
    try {
      const reaction = state.reactions.find(r => r.id === combo.reactionId);
      const demo = state.demos.find(d => d.id === combo.demoId);
      const hook = state.hooks[combo.hookIndex] || '';
      
      if (!reaction || !demo) {
        job.errors.push(`Missing files for combo`);
        continue;
      }
      
      const outputFile = `${OUTPUT_DIR}/tiktok_${jobId}_${job.completed + 1}.mp4`;
      await createVideo(reaction, demo, hook, outputFile);
      
      job.outputs.push({
        file: outputFile,
        url: `/${outputFile}`,
        reaction: reaction.originalName,
        demo: demo.originalName,
        hook: hook.substring(0, 50) + '...'
      });
      job.completed++;
    } catch (err) {
      job.errors.push(err.message);
    }
  }
  
  job.status = 'complete';
});

// Job status
app.get('/api/jobs/:id', (req, res) => {
  const job = state.jobs.find(j => j.id === req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json(job);
});

// Get all outputs
app.get('/api/outputs', (req, res) => {
  if (!fs.existsSync(OUTPUT_DIR)) return res.json([]);
  
  const files = fs.readdirSync(OUTPUT_DIR)
    .filter(f => f.endsWith('.mp4'))
    .map(f => ({
      filename: f,
      url: `/output/${f}`,
      size: fs.statSync(`${OUTPUT_DIR}/${f}`).size
    }));
  res.json(files);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🎬 TikTok Editor running on http://localhost:${PORT}`);
});
