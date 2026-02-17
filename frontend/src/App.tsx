import { useState, useEffect, useRef } from 'react'
import { Upload, Music, Play, Pause, Trash2, Link, Loader2, Download, Volume2, VolumeX, RefreshCw, Plus, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn, formatBytes, api } from '@/lib/utils'
import { useToast } from '@/components/ui/toast'

interface FileInfo {
  id: string
  filename: string
  originalName: string
  size: number
}

interface LibraryFile {
  id: string
  filename: string
  size: number
  url: string
  thumb?: string
}

interface Output {
  id: string
  filename: string
  url: string
  size: number
}

// Template thumbnail with lazy video loading
function TemplateThumb({ template, selected, onSelect }: { 
  template: { id: string; url: string; thumb?: string }; 
  selected: boolean; 
  onSelect: () => void 
}) {
  const [showVideo, setShowVideo] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  
  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setShowVideo(true)}
      onMouseLeave={() => {
        setShowVideo(false)
        if (videoRef.current) {
          videoRef.current.pause()
          videoRef.current.currentTime = 0
        }
      }}
      className={cn(
        "relative aspect-square rounded-xl overflow-hidden cursor-pointer transition-all select-none",
        selected 
          ? "ring-2 ring-primary ring-offset-2" 
          : "hover:ring-2 hover:ring-muted-foreground/50"
      )}
    >
      {/* Thumbnail (always visible, loads fast) */}
      {template.thumb && (
        <img 
          src={template.thumb} 
          alt="" 
          className={cn(
            "absolute inset-0 w-full h-full object-cover",
            showVideo && "opacity-0"
          )}
          loading="lazy"
        />
      )}
      
      {/* Video (only loads on hover) */}
      {showVideo && (
        <video
          ref={videoRef}
          src={template.url}
          className="absolute inset-0 w-full h-full object-cover"
          muted
          playsInline
          autoPlay
          loop
          controlsList="nodownload nofullscreen noremoteplayback"
          disablePictureInPicture
          onContextMenu={(e) => e.preventDefault()}
        />
      )}
      
      {/* Fallback if no thumb */}
      {!template.thumb && !showVideo && (
        <div className="absolute inset-0 bg-muted animate-pulse" />
      )}
      
      {/* Selected checkmark */}
      {selected && (
        <div className="absolute inset-0 bg-primary/20 flex items-center justify-center pointer-events-none">
          <div className="w-5 h-5 bg-primary rounded-full flex items-center justify-center">
            <span className="text-white text-xs">✓</span>
          </div>
        </div>
      )}
    </div>
  )
}

// Video player for outputs
function VideoCard({ video, onDelete }: { video: Output; onDelete: (id: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(true)
  const [progress, setProgress] = useState(0)

  const togglePlay = () => {
    if (!videoRef.current) return
    if (isPlaying) {
      videoRef.current.pause()
    } else {
      videoRef.current.play()
    }
    setIsPlaying(!isPlaying)
  }

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!videoRef.current) return
    videoRef.current.muted = !isMuted
    setIsMuted(!isMuted)
  }

  const handleTimeUpdate = () => {
    if (!videoRef.current) return
    const pct = (videoRef.current.currentTime / videoRef.current.duration) * 100
    setProgress(pct)
  }

  const handleEnded = () => {
    setIsPlaying(false)
    setProgress(0)
  }

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current) return
    const rect = e.currentTarget.getBoundingClientRect()
    const pct = (e.clientX - rect.left) / rect.width
    videoRef.current.currentTime = pct * videoRef.current.duration
  }

  return (
    <div className="group relative aspect-[9/16] bg-black rounded-xl overflow-hidden">
      <video
        ref={videoRef}
        src={video.url}
        className="w-full h-full object-cover cursor-pointer"
        muted={isMuted}
        playsInline
        preload="metadata"
        onClick={togglePlay}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      />
      
      <div 
        className={cn(
          "absolute inset-0 flex items-center justify-center bg-black/20 transition-opacity cursor-pointer",
          isPlaying ? "opacity-0 hover:opacity-100" : "opacity-100"
        )}
        onClick={togglePlay}
      >
        <div className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
          {isPlaying ? <Pause className="w-6 h-6 text-black" /> : <Play className="w-6 h-6 text-black ml-1" />}
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
        <div className="h-1 bg-white/30 rounded-full mb-3 cursor-pointer" onClick={handleSeek}>
          <div className="h-full bg-white rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0 mr-3">
            <p className="text-xs text-white truncate font-medium">{video.filename}</p>
            <p className="text-xs text-white/60">{formatBytes(video.size)}</p>
          </div>
          
          <div className="flex items-center gap-1">
            <button onClick={toggleMute} className="p-2 hover:bg-white/20 rounded-full transition-colors">
              {isMuted ? <VolumeX className="w-4 h-4 text-white" /> : <Volume2 className="w-4 h-4 text-white" />}
            </button>
            <a href={video.url} download onClick={(e) => e.stopPropagation()} className="p-2 hover:bg-white/20 rounded-full transition-colors">
              <Download className="w-4 h-4 text-white" />
            </a>
            <button onClick={(e) => { e.stopPropagation(); onDelete(video.id) }} className="p-2 hover:bg-red-500/50 rounded-full transition-colors">
              <Trash2 className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function App() {
  const { toast, update } = useToast()
  
  // Data
  const [libraryReactions, setLibraryReactions] = useState<LibraryFile[]>([])
  const [uploadedReactions, setUploadedReactions] = useState<FileInfo[]>([])
  const [demos, setDemos] = useState<FileInfo[]>([])
  const [music, setMusic] = useState<FileInfo[]>([])
  const [hooks, setHooks] = useState<string[]>([])
  const [outputs, setOutputs] = useState<Output[]>([])
  
  // UI state
  const [hooksText, setHooksText] = useState('')
  const [textPosition, setTextPosition] = useState<'top' | 'center' | 'bottom'>('center')
  const [selectedTemplate, setSelectedTemplate] = useState<string>('')
  const [selectedMusic, setSelectedMusic] = useState('')
  const [musicVolume, setMusicVolume] = useState('0.3')
  const [tiktokUrl, setTiktokUrl] = useState('')
  const [isExtracting, setIsExtracting] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [isRefreshing, setIsRefreshing] = useState(false)
  
  // Trim settings
  const [templateStart, setTemplateStart] = useState('')
  const [templateDuration, setTemplateDuration] = useState('')
  const [demoStart, setDemoStart] = useState('')
  const [demoDuration, setDemoDuration] = useState('')
  
  // Selected demo for preview
  const [selectedDemo, setSelectedDemo] = useState('')

  // All available templates (library + uploads)
  const allTemplates = [
    ...libraryReactions.map(l => ({ ...l, type: 'library' as const })),
    ...uploadedReactions.map(u => ({ id: u.id, filename: u.originalName, size: u.size, url: `/api/files/reactions/${u.id}/preview`, type: 'upload' as const }))
  ]
  
  const selectedTemplateData = allTemplates.find(t => t.id === selectedTemplate)

  // Load data
  useEffect(() => {
    loadLibrary()
    loadFiles('reactions').then(setUploadedReactions)
    loadFiles('demos').then(setDemos)
    loadFiles('music').then(setMusic)
    loadHooks()
    loadOutputs()
  }, [])

  const loadLibrary = async () => {
    const res = await api('/api/library/reactions')
    setLibraryReactions(await res.json())
  }

  const loadFiles = async (type: string): Promise<FileInfo[]> => {
    const res = await api(`/api/files/${type}`)
    return res.json()
  }

  const loadHooks = async () => {
    const res = await api('/api/hooks')
    const data = await res.json()
    setHooks(data)
    setHooksText(data.join('\n'))
  }

  const loadOutputs = async (showToast = false) => {
    if (showToast) setIsRefreshing(true)
    const res = await api('/api/outputs')
    setOutputs(await res.json())
    if (showToast) {
      toast('Videos refreshed')
      setIsRefreshing(false)
    }
  }

  const uploadFiles = async (type: string, files: FileList) => {
    const formData = new FormData()
    Array.from(files).forEach(f => formData.append('files', f))
    
    await api(`/api/files/${type}`, { method: 'POST', body: formData })
    
    if (type === 'reactions') setUploadedReactions(await loadFiles('reactions'))
    else if (type === 'demos') setDemos(await loadFiles('demos'))
    else if (type === 'music') setMusic(await loadFiles('music'))
    
    toast(`${files.length} file${files.length > 1 ? 's' : ''} uploaded`)
  }

  const deleteFile = async (type: string, id: string) => {
    await api(`/api/files/${type}/${id}`, { method: 'DELETE' })
    if (type === 'reactions') setUploadedReactions(await loadFiles('reactions'))
    else if (type === 'demos') setDemos(await loadFiles('demos'))
    else if (type === 'music') setMusic(await loadFiles('music'))
    toast('File deleted')
  }

  const deleteOutput = async (id: string) => {
    await api(`/api/outputs/${id}`, { method: 'DELETE' })
    setOutputs(outputs.filter(o => o.id !== id))
    toast('Video deleted')
  }

  const saveHooks = async () => {
    const newHooks = hooksText.split('\n').filter(h => h.trim())
    await api('/api/hooks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hooks: newHooks })
    })
    setHooks(newHooks)
    toast(`${newHooks.length} hooks saved`)
  }

  const extractTikTok = async () => {
    if (!tiktokUrl.trim() || !tiktokUrl.includes('tiktok.com')) {
      toast('Enter a valid TikTok URL', 'error')
      return
    }
    
    setIsExtracting(true)
    const toastId = toast('Extracting audio...', 'loading')
    
    try {
      const res = await api('/api/tiktok/extract-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: tiktokUrl })
      })
      const data = await res.json()
      if (data.success) {
        setTiktokUrl('')
        setMusic(await loadFiles('music'))
        update(toastId, `Added: ${data.title || 'TikTok audio'}`, 'success')
      } else {
        update(toastId, data.message || 'Extraction failed', 'error')
      }
    } catch {
      update(toastId, 'Extraction failed', 'error')
    } finally {
      setIsExtracting(false)
    }
  }

  const generate = async () => {
    if (!selectedTemplate || !demos.length) {
      toast('Select a template and upload demos', 'error')
      return
    }
    
    setIsGenerating(true)
    const combinations = []
    
    // Create one video per demo with the selected template
    for (const demo of demos) {
      const hookIndex = hooks.length ? Math.floor(Math.random() * hooks.length) : -1
      let musicId = undefined
      if (selectedMusic === 'random' && music.length > 0) {
        musicId = music[Math.floor(Math.random() * music.length)].id
      } else if (selectedMusic && selectedMusic !== 'random') {
        musicId = selectedMusic
      }
      combinations.push({ reactionId: selectedTemplate, demoId: demo.id, hookIndex, musicId })
    }
    
    setProgress({ current: 0, total: combinations.length })
    toast(`Generating ${combinations.length} video${combinations.length > 1 ? 's' : ''}...`, 'loading')
    
    try {
      const res = await api('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          combinations,
          textSettings: { maxWidthPercent: 60, fontSize: 38, align: 'center', position: textPosition },
          audioSettings: { musicVolume: parseFloat(musicVolume) },
          trimSettings: {
            reactionStart: templateStart ? parseFloat(templateStart) : undefined,
            reactionDuration: templateDuration ? parseFloat(templateDuration) : undefined,
            demoStart: demoStart ? parseFloat(demoStart) : undefined,
            demoDuration: demoDuration ? parseFloat(demoDuration) : undefined
          }
        })
      })
      
      const data = await res.json()
      if (data.success) {
        pollJobs(data.jobIds)
      }
    } catch {
      toast('Generation failed', 'error')
      setIsGenerating(false)
    }
  }

  const pollJobs = async (jobIds: string[]) => {
    const check = async () => {
      let completed = 0
      let failed = 0
      let allDone = true
      
      for (const id of jobIds) {
        const res = await api(`/api/jobs/${id}`)
        const job = await res.json()
        if (job.state === 'completed') completed++
        else if (job.state === 'failed') { completed++; failed++ }
        else allDone = false
      }
      
      setProgress({ current: completed, total: jobIds.length })
      
      if (allDone) {
        setIsGenerating(false)
        loadOutputs()
        const success = jobIds.length - failed
        toast(failed > 0 ? `Done: ${success} created, ${failed} failed` : `${success} videos ready!`, failed === jobIds.length ? 'error' : 'success')
      } else {
        setTimeout(check, 2000)
      }
    }
    setTimeout(check, 1000)
  }

  const canGenerate = selectedTemplate && demos.length > 0

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center gap-3">
            <img src="/favicon.svg" alt="ClawdClipper" className="w-8 h-8" />
            <h1 className="text-xl font-semibold tracking-tight">ClawdClipper</h1>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Left Column */}
          <div className="space-y-6">
            {/* Video Text / Hooks */}
            <div className="bg-white border border-border rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="font-semibold">Text Hooks</h2>
                  <p className="text-xs text-muted-foreground">One per line • Random hook per video</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{hooks.length} saved</span>
                  <Button size="sm" variant="ghost" onClick={saveHooks}>Save</Button>
                </div>
              </div>
              <textarea
                value={hooksText}
                onChange={(e) => setHooksText(e.target.value)}
                placeholder="Wait until you see this...&#10;This app changed my life&#10;POV: You just discovered..."
                className="w-full h-28 p-3 bg-muted/30 border border-border rounded-xl text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring font-mono"
              />
              <div className="flex items-center justify-between mt-3">
                <p className="text-xs text-muted-foreground">Position:</p>
                <div className="flex gap-1">
                  {(['top', 'center', 'bottom'] as const).map(pos => (
                    <button
                      key={pos}
                      onClick={() => setTextPosition(pos)}
                      className={cn(
                        "px-3 py-1.5 text-xs rounded-lg font-medium transition-colors",
                        textPosition === pos 
                          ? "bg-primary text-primary-foreground" 
                          : "bg-muted text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {pos.charAt(0).toUpperCase() + pos.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* UGC Templates */}
            <div className="bg-white border border-border rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold">Select UGC Template</h2>
                <label className="cursor-pointer">
                  <input
                    type="file"
                    multiple
                    accept="video/*"
                    className="hidden"
                    onChange={(e) => e.target.files && uploadFiles('reactions', e.target.files)}
                  />
                  <span className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                    <Plus className="w-4 h-4" /> Upload more
                  </span>
                </label>
              </div>
              
              <div className="grid grid-cols-6 gap-2 max-h-64 overflow-y-auto">
                {allTemplates.map(t => (
                  <TemplateThumb 
                    key={t.id} 
                    template={t} 
                    selected={selectedTemplate === t.id}
                    onSelect={() => setSelectedTemplate(t.id)}
                  />
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                {libraryReactions.length} DansUGC Brolls{uploadedReactions.length > 0 && ` + ${uploadedReactions.length} uploads`}
              </p>
              
              {/* Template trim controls */}
              {selectedTemplate && (
                <div className="mt-4 pt-4 border-t border-border">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Trim UGC Reaction (optional)</p>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="text-xs text-muted-foreground">Start (sec)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={templateStart}
                        onChange={(e) => setTemplateStart(e.target.value)}
                        placeholder="0"
                        className="w-full h-9 px-3 bg-muted/30 border border-border rounded-lg text-sm"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs text-muted-foreground">Duration (sec)</label>
                      <input
                        type="number"
                        min="0.1"
                        step="0.1"
                        value={templateDuration}
                        onChange={(e) => setTemplateDuration(e.target.value)}
                        placeholder="Full"
                        className="w-full h-9 px-3 bg-muted/30 border border-border rounded-lg text-sm"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Call to Action */}
            <div className="bg-white border border-border rounded-2xl p-5">
              <h2 className="font-semibold mb-4">Call to Action (Demo Videos)</h2>
              
              <div
                className="border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:border-muted-foreground/50 transition-colors"
                onClick={() => document.getElementById('demo-upload')?.click()}
              >
                <input
                  id="demo-upload"
                  type="file"
                  multiple
                  accept="video/*"
                  className="hidden"
                  onChange={(e) => e.target.files && uploadFiles('demos', e.target.files)}
                />
                <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Click to upload demo videos</p>
                <p className="text-xs text-muted-foreground mt-1">App demos, screen recordings, etc.</p>
              </div>
              
              {demos.length > 0 && (
                <div className="mt-4 space-y-2">
                  {demos.map(d => (
                    <div 
                      key={d.id} 
                      onClick={() => setSelectedDemo(d.id)}
                      className={cn(
                        "flex items-center justify-between py-2 px-3 rounded-lg group cursor-pointer transition-all",
                        selectedDemo === d.id 
                          ? "bg-primary text-primary-foreground" 
                          : "bg-muted/30 hover:bg-muted"
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Play className="w-4 h-4 shrink-0 opacity-60" />
                        <span className="text-sm truncate">{d.originalName}</span>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteFile('demos', d.id) }}
                        className={cn(
                          "opacity-0 group-hover:opacity-100 p-1 rounded transition-all",
                          selectedDemo === d.id ? "hover:bg-white/20" : "hover:bg-background"
                        )}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Demo trim controls */}
              {demos.length > 0 && (
                <div className="mt-4 pt-4 border-t border-border">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Trim Demo Videos (optional)</p>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="text-xs text-muted-foreground">Start (sec)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={demoStart}
                        onChange={(e) => setDemoStart(e.target.value)}
                        placeholder="0"
                        className="w-full h-9 px-3 bg-muted/30 border border-border rounded-lg text-sm"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs text-muted-foreground">Duration (sec)</label>
                      <input
                        type="number"
                        min="0.1"
                        step="0.1"
                        value={demoDuration}
                        onChange={(e) => setDemoDuration(e.target.value)}
                        placeholder="Full"
                        className="w-full h-9 px-3 bg-muted/30 border border-border rounded-lg text-sm"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Live Preview */}
            <div className="bg-muted/30 border border-border rounded-2xl p-4">
              <h2 className="font-semibold mb-3">Preview</h2>
              
              <div className="relative aspect-[9/16] bg-black rounded-xl overflow-hidden">
                {selectedTemplateData ? (
                  <>
                    {/* Template video with text overlay */}
                    <video
                      src={selectedTemplateData.url}
                      className="absolute inset-0 w-full h-full object-cover"
                      autoPlay
                      loop
                      muted
                      playsInline
                      controlsList="nodownload nofullscreen noremoteplayback"
                      disablePictureInPicture
                      onContextMenu={(e) => e.preventDefault()}
                    />
                    
                    {/* Text overlay */}
                    {hooksText && (
                      <div 
                        className={cn(
                          "absolute left-0 right-0 px-4 flex justify-center",
                          textPosition === 'top' && "top-[15%]",
                          textPosition === 'center' && "top-1/2 -translate-y-1/2",
                          textPosition === 'bottom' && "bottom-[25%]"
                        )}
                      >
                        <p 
                          className="text-white text-center font-bold leading-tight"
                          style={{ 
                            fontSize: '14px',
                            textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
                            maxWidth: '60%',
                            whiteSpace: 'pre-wrap'
                          }}
                        >
                          {hooksText.split('\n')[0] || 'Your text here...'}
                        </p>
                      </div>
                    )}
                    
                    {/* Section indicator */}
                    <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                      UGC Reaction
                    </div>
                  </>
                ) : demos.length > 0 ? (
                  <>
                    {/* Show demo if no template selected */}
                    <video
                      src={`/api/files/demos/${demos[0].id}/preview`}
                      className="absolute inset-0 w-full h-full object-cover opacity-50"
                      muted
                      playsInline
                      preload="metadata"
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <p className="text-white/80 text-sm">Select a template above</p>
                    </div>
                  </>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <p className="text-muted-foreground text-sm text-center px-4">
                      Select a template and upload demos to preview
                    </p>
                  </div>
                )}
              </div>
              
              {/* Demo preview below */}
              {demos.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs text-muted-foreground mb-2">
                    {selectedDemo ? 'Selected Demo:' : 'Click a demo to preview →'}
                  </p>
                  {selectedDemo && (
                    <div className="relative aspect-[9/16] bg-black rounded-lg overflow-hidden max-h-40">
                      <video
                        key={selectedDemo}
                        src={`/api/files/demos/${selectedDemo}/preview`}
                        className="w-full h-full object-cover"
                        autoPlay
                        loop
                        muted
                        playsInline
                      />
                      <div className="absolute top-1 left-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">
                        Call to Action
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {/* Summary */}
              <div className="mt-4 pt-4 border-t border-border text-xs text-muted-foreground space-y-1">
                <p>✓ Template: {selectedTemplateData ? selectedTemplateData.filename : 'None selected'}</p>
                <p>✓ Demo: {selectedDemo ? demos.find(d => d.id === selectedDemo)?.originalName : `${demos.length} uploaded`}</p>
                <p>✓ Hooks: {hooks.length > 0 ? `${hooks.length} saved (random per video)` : 'None'}</p>
                <p>✓ Music: {selectedMusic ? (selectedMusic === 'random' ? 'Random' : 'Selected') : 'None'}</p>
              </div>
            </div>

            {/* Music */}
            <div className="bg-white border border-border rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold">Upload Music</h2>
              </div>
              
              {/* TikTok extraction */}
              <div className="flex gap-2 mb-4">
                <div className="relative flex-1">
                  <Link className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={tiktokUrl}
                    onChange={(e) => setTiktokUrl(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && extractTikTok()}
                    placeholder="Paste TikTok URL to extract audio..."
                    className="w-full h-10 pl-10 pr-4 bg-muted/30 border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
                <Button size="sm" onClick={extractTikTok} disabled={isExtracting}>
                  {isExtracting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Extract'}
                </Button>
              </div>
              
              <div
                className="border-2 border-dashed border-primary/50 rounded-xl p-6 text-center cursor-pointer hover:border-primary transition-colors bg-primary/5"
                onClick={() => document.getElementById('music-upload')?.click()}
              >
                <input
                  id="music-upload"
                  type="file"
                  multiple
                  accept="audio/*"
                  className="hidden"
                  onChange={(e) => e.target.files && uploadFiles('music', e.target.files)}
                />
                <Music className="w-8 h-8 mx-auto mb-2 text-primary/60" />
                <p className="text-sm text-muted-foreground">Click or drag to upload music</p>
                <p className="text-xs text-muted-foreground mt-1">MP3, WAV files accepted</p>
              </div>
              
              {music.length > 0 && (
                <div className="mt-4">
                  <select
                    value={selectedMusic}
                    onChange={(e) => setSelectedMusic(e.target.value)}
                    className="w-full h-10 px-3 bg-muted/30 border border-border rounded-lg text-sm"
                  >
                    <option value="">No music</option>
                    <option value="random">🎲 Random track</option>
                    {music.map(m => (
                      <option key={m.id} value={m.id}>{m.originalName}</option>
                    ))}
                  </select>
                  {selectedMusic && (
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs text-muted-foreground">Volume:</span>
                      <select
                        value={musicVolume}
                        onChange={(e) => setMusicVolume(e.target.value)}
                        className="h-8 px-2 bg-muted/30 border border-border rounded-lg text-xs"
                      >
                        <option value="0.2">20%</option>
                        <option value="0.3">30%</option>
                        <option value="0.5">50%</option>
                        <option value="0.7">70%</option>
                        <option value="1">100%</option>
                      </select>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Generate Button */}
        <div className="mt-8 bg-muted/30 border border-border rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                {canGenerate 
                  ? `Ready to create ${demos.length} video${demos.length > 1 ? 's' : ''}`
                  : 'Select a template and upload demos to get started'
                }
              </p>
            </div>
            <Button 
              size="lg"
              onClick={generate}
              disabled={isGenerating || !canGenerate}
              className="min-w-[160px]"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {progress.current}/{progress.total}
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Outputs */}
        {outputs.length > 0 && (
          <div className="mt-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-semibold">Generated Videos</h2>
              <Button size="sm" variant="ghost" onClick={() => loadOutputs(true)} disabled={isRefreshing}>
                <RefreshCw className={cn("w-4 h-4 mr-1", isRefreshing && "animate-spin")} />
                Refresh
              </Button>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {outputs.map(o => (
                <VideoCard key={o.id} video={o} onDelete={deleteOutput} />
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default App
