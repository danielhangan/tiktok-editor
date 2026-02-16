import { useState, useEffect, useCallback } from 'react'
import { Upload, Music, Type, Sparkles, Play, Trash2, Link, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn, formatBytes, api } from '@/lib/utils'

interface FileInfo {
  id: string
  filename: string
  originalName: string
  size: number
}

interface Output {
  id: string
  filename: string
  url: string
  size: number
}

function App() {
  const [reactions, setReactions] = useState<FileInfo[]>([])
  const [demos, setDemos] = useState<FileInfo[]>([])
  const [music, setMusic] = useState<FileInfo[]>([])
  const [hooks, setHooks] = useState<string[]>([])
  const [hooksText, setHooksText] = useState('')
  const [outputs, setOutputs] = useState<Output[]>([])
  const [selectedMusic, setSelectedMusic] = useState('')
  const [musicVolume, setMusicVolume] = useState('0.3')
  const [tiktokUrl, setTiktokUrl] = useState('')
  const [isExtracting, setIsExtracting] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0 })

  // Load initial data
  useEffect(() => {
    loadFiles('reactions').then(setReactions)
    loadFiles('demos').then(setDemos)
    loadFiles('music').then(setMusic)
    loadHooks()
    loadOutputs()
  }, [])

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

  const loadOutputs = async () => {
    const res = await api('/api/outputs')
    setOutputs(await res.json())
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
  }

  const extractTikTok = async () => {
    if (!tiktokUrl.trim() || !tiktokUrl.includes('tiktok.com')) return
    
    setIsExtracting(true)
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
      }
    } finally {
      setIsExtracting(false)
    }
  }

  const generate = async () => {
    if (!reactions.length || !demos.length) return
    
    setIsGenerating(true)
    const combinations = []
    
    for (const reaction of reactions) {
      for (const demo of demos) {
        const hookIndex = hooks.length ? Math.floor(Math.random() * hooks.length) : -1
        // Random music assignment per video
        let musicId = undefined
        if (selectedMusic === 'random' && music.length > 0) {
          musicId = music[Math.floor(Math.random() * music.length)].id
        } else if (selectedMusic && selectedMusic !== 'random') {
          musicId = selectedMusic
        }
        combinations.push({ reactionId: reaction.id, demoId: demo.id, hookIndex, musicId })
      }
    }
    
    setProgress({ current: 0, total: combinations.length })
    
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
      setIsGenerating(false)
    }
  }

  const pollJobs = async (jobIds: string[]) => {
    let completed = 0
    
    const check = async () => {
      completed = 0
      let allDone = true
      
      for (const id of jobIds) {
        const res = await api(`/api/jobs/${id}`)
        const job = await res.json()
        if (job.state === 'completed' || job.state === 'failed') {
          completed++
        } else {
          allDone = false
        }
      }
      
      setProgress({ current: completed, total: jobIds.length })
      
      if (allDone) {
        setIsGenerating(false)
        loadOutputs()
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

  const totalCombinations = reactions.length * demos.length

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="max-w-6xl mx-auto px-6 py-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold tracking-tight">TikTok Editor</h1>
              <p className="text-sm text-muted-foreground">Create viral UGC videos at scale</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        {/* Upload Grid */}
        <div className="grid md:grid-cols-3 gap-8 mb-12">
          <DropZone type="reactions" files={reactions} icon={Upload} accept="video/*" label="Face Reactions" />
          <DropZone type="demos" files={demos} icon={Play} accept="video/*" label="App Demos" />
          
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
                {totalCombinations} possible combinations • {hooks.length} hooks
              </p>
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
                disabled={isGenerating || !reactions.length || !demos.length}
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
            <Button size="sm" variant="ghost" onClick={loadOutputs}>Refresh</Button>
          </div>
          
          {outputs.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Sparkles className="w-10 h-10 mx-auto mb-4 opacity-30" />
              <p>No videos yet. Upload files and generate!</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {outputs.map(o => (
                <div key={o.id} className="group relative aspect-[9/16] bg-black rounded-xl overflow-hidden">
                  <video 
                    src={o.url} 
                    className="w-full h-full object-cover"
                    controls
                    preload="metadata"
                  />
                  <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                    <p className="text-xs text-white truncate">{o.filename}</p>
                    <p className="text-xs text-white/60">{formatBytes(o.size)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default App
