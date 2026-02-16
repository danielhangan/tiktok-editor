import { useState, useEffect, useCallback, useRef } from 'react'
import { Upload, Music, Type, Sparkles, Play, Pause, Trash2, Link, Loader2, Download, Volume2, VolumeX, RefreshCw } from 'lucide-react'
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
}

interface Output {
  id: string
  filename: string
  url: string
  size: number
}

// Clean video player component
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
      
      {/* Play/Pause overlay */}
      <div 
        className={cn(
          "absolute inset-0 flex items-center justify-center bg-black/20 transition-opacity cursor-pointer",
          isPlaying ? "opacity-0 hover:opacity-100" : "opacity-100"
        )}
        onClick={togglePlay}
      >
        <div className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
          {isPlaying ? (
            <Pause className="w-6 h-6 text-black" />
          ) : (
            <Play className="w-6 h-6 text-black ml-1" />
          )}
        </div>
      </div>

      {/* Bottom controls */}
      <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
        {/* Progress bar */}
        <div 
          className="h-1 bg-white/30 rounded-full mb-3 cursor-pointer"
          onClick={handleSeek}
        >
          <div 
            className="h-full bg-white rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0 mr-3">
            <p className="text-xs text-white truncate font-medium">{video.filename}</p>
            <p className="text-xs text-white/60">{formatBytes(video.size)}</p>
          </div>
          
          <div className="flex items-center gap-1">
            <button
              onClick={toggleMute}
              className="p-2 hover:bg-white/20 rounded-full transition-colors"
            >
              {isMuted ? (
                <VolumeX className="w-4 h-4 text-white" />
              ) : (
                <Volume2 className="w-4 h-4 text-white" />
              )}
            </button>
            <a
              href={video.url}
              download
              onClick={(e) => e.stopPropagation()}
              className="p-2 hover:bg-white/20 rounded-full transition-colors"
            >
              <Download className="w-4 h-4 text-white" />
            </a>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(video.id) }}
              className="p-2 hover:bg-red-500/50 rounded-full transition-colors"
            >
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
  const [reactions, setReactions] = useState<FileInfo[]>([])
  const [demos, setDemos] = useState<FileInfo[]>([])
  const [music, setMusic] = useState<FileInfo[]>([])
  const [libraryReactions, setLibraryReactions] = useState<LibraryFile[]>([])
  const [useLibrary, setUseLibrary] = useState(false)
  const [hooks, setHooks] = useState<string[]>([])
  const [hooksText, setHooksText] = useState('')
  const [outputs, setOutputs] = useState<Output[]>([])
  const [selectedMusic, setSelectedMusic] = useState('')
  const [musicVolume, setMusicVolume] = useState('0.3')
  const [tiktokUrl, setTiktokUrl] = useState('')
  const [isExtracting, setIsExtracting] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [isRefreshing, setIsRefreshing] = useState(false)
  // Single selection mode
  const [singleMode, setSingleMode] = useState(false)
  const [selectedReaction, setSelectedReaction] = useState('')
  const [selectedDemo, setSelectedDemo] = useState('')

  // Load initial data
  useEffect(() => {
    loadFiles('reactions').then(setReactions)
    loadFiles('demos').then(setDemos)
    loadFiles('music').then(setMusic)
    loadLibrary()
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

  const deleteOutput = async (id: string) => {
    await api(`/api/outputs/${id}`, { method: 'DELETE' })
    setOutputs(outputs.filter(o => o.id !== id))
    toast('Video deleted')
  }

  const uploadFiles = async (type: string, files: FileList) => {
    const formData = new FormData()
    Array.from(files).forEach(f => formData.append('files', f))
    
    await api(`/api/files/${type}`, { method: 'POST', body: formData })
    
    if (type === 'reactions') setReactions(await loadFiles('reactions'))
    else if (type === 'demos') setDemos(await loadFiles('demos'))
    else if (type === 'music') setMusic(await loadFiles('music'))
  }

  const deleteFile = async (type: string, id: string) => {
    await api(`/api/files/${type}/${id}`, { method: 'DELETE' })
    if (type === 'reactions') setReactions(await loadFiles('reactions'))
    else if (type === 'demos') setDemos(await loadFiles('demos'))
    else if (type === 'music') setMusic(await loadFiles('music'))
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
    const activeReactions = useLibrary ? libraryReactions : reactions
    const demoList = demos
    
    if (!activeReactions.length || !demoList.length) {
      toast('Upload demos and select reactions first', 'error')
      return
    }
    
    // Single mode validation
    if (singleMode) {
      if (!selectedReaction || !selectedDemo) {
        toast('Select a reaction and demo', 'error')
        return
      }
    }
    
    setIsGenerating(true)
    const combinations = []
    
    if (singleMode) {
      // Single video mode
      const hookIndex = hooks.length ? Math.floor(Math.random() * hooks.length) : -1
      let musicId = undefined
      if (selectedMusic === 'random' && music.length > 0) {
        musicId = music[Math.floor(Math.random() * music.length)].id
      } else if (selectedMusic && selectedMusic !== 'random') {
        musicId = selectedMusic
      }
      combinations.push({ reactionId: selectedReaction, demoId: selectedDemo, hookIndex, musicId })
    } else {
      // All combinations mode
      for (const reaction of activeReactions) {
        for (const demo of demoList) {
          const hookIndex = hooks.length ? Math.floor(Math.random() * hooks.length) : -1
          let musicId = undefined
          if (selectedMusic === 'random' && music.length > 0) {
            musicId = music[Math.floor(Math.random() * music.length)].id
          } else if (selectedMusic && selectedMusic !== 'random') {
            musicId = selectedMusic
          }
          combinations.push({ reactionId: reaction.id, demoId: demo.id, hookIndex, musicId })
        }
      }
    }
    
    setProgress({ current: 0, total: combinations.length })
    toast(`Generating ${combinations.length} video${combinations.length > 1 ? 's' : ''}...`, 'loading')
    
    try {
      const res = await api('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          combinations,
          textSettings: { maxWidthPercent: 60, fontSize: 38, align: 'center', position: 'center' },
          audioSettings: { musicVolume: parseFloat(musicVolume) }
        })
      })
      
      const data = await res.json()
      if (data.success) {
        // Poll for completion
        pollJobs(data.jobIds)
      }
    } catch {
      toast('Generation failed', 'error')
      setIsGenerating(false)
    }
  }

  const pollJobs = async (jobIds: string[]) => {
    let completed = 0
    
    const check = async () => {
      completed = 0
      let allDone = true
      let failed = 0
      
      for (const id of jobIds) {
        const res = await api(`/api/jobs/${id}`)
        const job = await res.json()
        if (job.state === 'completed') {
          completed++
        } else if (job.state === 'failed') {
          completed++
          failed++
        } else {
          allDone = false
        }
      }
      
      setProgress({ current: completed, total: jobIds.length })
      
      if (allDone) {
        setIsGenerating(false)
        loadOutputs()
        const success = jobIds.length - failed
        if (failed > 0) {
          toast(`Done: ${success} videos created, ${failed} failed`, failed === jobIds.length ? 'error' : 'success')
        } else {
          toast(`${success} videos ready!`, 'success')
        }
      } else {
        setTimeout(check, 2000)
      }
    }
    
    setTimeout(check, 1000)
  }

  const DropZone = ({ type, files, icon: Icon, accept, label }: {
    type: string
    files: FileInfo[]
    icon: typeof Upload
    accept: string
    label: string
  }) => {
    const [isDragging, setIsDragging] = useState(false)
    
    const handleDrop = useCallback((e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      if (e.dataTransfer.files.length) {
        uploadFiles(type, e.dataTransfer.files)
      }
    }, [type])

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-foreground">{label}</h3>
          <span className="text-xs text-muted-foreground">{files.length} files</span>
        </div>
        
        <div
          className={cn(
            "relative border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer",
            isDragging ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/50"
          )}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => document.getElementById(`input-${type}`)?.click()}
        >
          <input
            id={`input-${type}`}
            type="file"
            multiple
            accept={accept}
            className="hidden"
            onChange={(e) => e.target.files && uploadFiles(type, e.target.files)}
          />
          <Icon className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Drop files or <span className="text-foreground font-medium">browse</span>
          </p>
        </div>
        
        {files.length > 0 && (
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {files.map(f => (
              <div key={f.id} className="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-lg group">
                <div className="flex items-center gap-3 min-w-0">
                  <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-sm truncate">{f.originalName}</span>
                  <span className="text-xs text-muted-foreground">{formatBytes(f.size)}</span>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteFile(type, f.id) }}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-background rounded transition-all"
                >
                  <Trash2 className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  const activeReactions = useLibrary ? libraryReactions : reactions
  const totalCombinations = activeReactions.length * demos.length

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="max-w-6xl mx-auto px-6 py-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3">
              <img src="/favicon.svg" alt="ClawdClipper" className="w-9 h-9" />
              <div>
                <h1 className="text-xl font-semibold tracking-tight">ClawdClipper</h1>
                <p className="text-sm text-muted-foreground">Create viral UGC videos at scale</p>
              </div>
            </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        {/* Upload Grid */}
        <div className="grid md:grid-cols-3 gap-8 mb-12">
          {/* Reactions - with library toggle */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-foreground">Face Reactions</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setUseLibrary(false)}
                  className={cn(
                    "px-2 py-1 text-xs rounded-md transition-colors",
                    !useLibrary ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  My Uploads
                </button>
                <button
                  onClick={() => setUseLibrary(true)}
                  className={cn(
                    "px-2 py-1 text-xs rounded-md transition-colors",
                    useLibrary ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  DansUGC Brolls ({libraryReactions.length})
                </button>
              </div>
            </div>
            
            {useLibrary ? (
              <div className="border-2 border-border rounded-xl p-3 bg-muted/20">
                <p className="text-xs text-muted-foreground mb-2">
                  {singleMode ? 'Click to select one:' : `All ${libraryReactions.length} Brolls will be used:`}
                </p>
                <div className="grid grid-cols-3 gap-2 max-h-52 overflow-y-auto">
                  {libraryReactions.map(f => (
                    <div 
                      key={f.id}
                      onClick={() => singleMode && setSelectedReaction(f.id)}
                      className={cn(
                        "relative aspect-[9/16] rounded-lg overflow-hidden cursor-pointer transition-all",
                        singleMode && selectedReaction === f.id 
                          ? "ring-2 ring-primary ring-offset-2" 
                          : singleMode ? "hover:ring-2 hover:ring-muted-foreground" : "opacity-90"
                      )}
                    >
                      <video
                        src={f.url}
                        className="w-full h-full object-cover"
                        muted
                        playsInline
                        preload="metadata"
                        onMouseEnter={(e) => e.currentTarget.play()}
                        onMouseLeave={(e) => { e.currentTarget.pause(); e.currentTarget.currentTime = 0 }}
                      />
                      {singleMode && selectedReaction === f.id && (
                        <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                          <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                            <span className="text-white text-xs">✓</span>
                          </div>
                        </div>
                      )}
                      <div className="absolute bottom-0 left-0 right-0 p-1 bg-gradient-to-t from-black/70 to-transparent">
                        <p className="text-[10px] text-white truncate">{f.filename.replace(/\.(mov|mp4)$/i, '')}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <>
                <DropZone type="reactions" files={reactions} icon={Upload} accept="video/*" label="" />
                {singleMode && reactions.length > 0 && (
                  <select
                    value={selectedReaction}
                    onChange={(e) => setSelectedReaction(e.target.value)}
                    className="w-full h-10 px-3 bg-muted/50 border border-border rounded-lg text-sm"
                  >
                    <option value="">Select reaction...</option>
                    {reactions.map(r => (
                      <option key={r.id} value={r.id}>{r.originalName}</option>
                    ))}
                  </select>
                )}
                {!singleMode && reactions.length > 0 && (
                  <p className="text-xs text-muted-foreground text-center">
                    All {reactions.length} uploads will be used
                  </p>
                )}
              </>
            )}
          </div>
          {/* Demos */}
          <div className="space-y-4">
            <DropZone type="demos" files={demos} icon={Play} accept="video/*" label="App Demos" />
            {singleMode && demos.length > 0 && (
              <>
                <p className="text-xs text-muted-foreground">Select one demo:</p>
                <select
                  value={selectedDemo}
                  onChange={(e) => setSelectedDemo(e.target.value)}
                  className="w-full h-10 px-3 bg-muted/50 border border-border rounded-lg text-sm"
                >
                  <option value="">Choose a demo...</option>
                  {demos.map(d => (
                    <option key={d.id} value={d.id}>{d.originalName}</option>
                  ))}
                </select>
              </>
            )}
            {!singleMode && demos.length > 0 && (
              <p className="text-xs text-muted-foreground text-center">
                All {demos.length} demos will be used
              </p>
            )}
          </div>
          
          {/* Music with TikTok extraction */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-foreground">Music</h3>
              <span className="text-xs text-muted-foreground">{music.length} tracks</span>
            </div>
            
            {/* TikTok URL Input */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Link className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  value={tiktokUrl}
                  onChange={(e) => setTiktokUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && extractTikTok()}
                  placeholder="Paste TikTok URL..."
                  className="w-full h-10 pl-10 pr-4 bg-muted/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <Button 
                size="sm" 
                onClick={extractTikTok} 
                disabled={isExtracting}
                className="shrink-0"
              >
                {isExtracting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Extract'}
              </Button>
            </div>
            
            <DropZone type="music" files={music} icon={Music} accept="audio/*" label="" />
          </div>
        </div>

        {/* Hooks */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
              <Type className="w-4 h-4" />
              Text Hooks
            </h3>
            <Button size="sm" variant="ghost" onClick={saveHooks}>Save</Button>
          </div>
          <textarea
            value={hooksText}
            onChange={(e) => setHooksText(e.target.value)}
            placeholder="Enter text hooks, one per line..."
            className="w-full h-32 p-4 bg-muted/30 border border-border rounded-xl text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        {/* Generate Section */}
        <div className="bg-muted/30 border border-border rounded-2xl p-8 mb-12">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <h2 className="text-lg font-semibold mb-1">Generate Videos</h2>
              <p className="text-sm text-muted-foreground">
                {singleMode 
                  ? '1 video (selected pair)' 
                  : `${totalCombinations} videos (${activeReactions.length} reactions × ${demos.length} demos)`
                } • {hooks.length} hooks
              </p>
              {/* Mode toggle */}
              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={() => setSingleMode(false)}
                  className={cn(
                    "px-3 py-1.5 text-xs rounded-lg transition-colors",
                    !singleMode ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
                  )}
                >
                  All Combinations
                </button>
                <button
                  onClick={() => setSingleMode(true)}
                  className={cn(
                    "px-3 py-1.5 text-xs rounded-lg transition-colors",
                    singleMode ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
                  )}
                >
                  Single Video
                </button>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              {/* Music Selection */}
              {music.length > 0 && (
                <div className="flex items-center gap-2">
                  <select
                    value={selectedMusic}
                    onChange={(e) => setSelectedMusic(e.target.value)}
                    className="h-10 px-3 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="">No music</option>
                    <option value="random">🎲 Random</option>
                    {music.map(m => (
                      <option key={m.id} value={m.id}>{m.originalName}</option>
                    ))}
                  </select>
                  {selectedMusic && (
                    <select
                      value={musicVolume}
                      onChange={(e) => setMusicVolume(e.target.value)}
                      className="h-10 px-3 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                      <option value="0.2">20%</option>
                      <option value="0.3">30%</option>
                      <option value="0.5">50%</option>
                      <option value="0.7">70%</option>
                      <option value="1">100%</option>
                    </select>
                  )}
                </div>
              )}
              
              <Button 
                variant="accent" 
                size="lg"
                onClick={generate}
                disabled={isGenerating || !activeReactions.length || !demos.length}
                className="min-w-[140px]"
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
        </div>

        {/* Outputs */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-medium text-foreground">Generated Videos</h3>
            <Button size="sm" variant="ghost" onClick={() => loadOutputs(true)} disabled={isRefreshing}>
              <RefreshCw className={cn("w-4 h-4 mr-1", isRefreshing && "animate-spin")} />
              Refresh
            </Button>
          </div>
          
          {outputs.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Sparkles className="w-10 h-10 mx-auto mb-4 opacity-30" />
              <p>No videos yet. Upload files and generate!</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {outputs.map(o => (
                <VideoCard key={o.id} video={o} onDelete={deleteOutput} />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default App
