import { useState, createContext, useContext, useCallback } from 'react'
import { X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Toast {
  id: string
  message: string
  type: 'success' | 'error' | 'loading'
}

interface ToastContextType {
  toast: (message: string, type?: Toast['type']) => string
  dismiss: (id: string) => void
  update: (id: string, message: string, type: Toast['type']) => void
}

const ToastContext = createContext<ToastContextType | null>(null)

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used within ToastProvider')
  return context
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const toast = useCallback((message: string, type: Toast['type'] = 'success') => {
    const id = crypto.randomUUID()
    setToasts(prev => [...prev, { id, message, type }])
    
    if (type !== 'loading') {
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id))
      }, 3000)
    }
    
    return id
  }, [])

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const update = useCallback((id: string, message: string, type: Toast['type']) => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, message, type } : t))
    
    if (type !== 'loading') {
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id))
      }, 3000)
    }
  }, [])

  return (
    <ToastContext.Provider value={{ toast, dismiss, update }}>
      {children}
      
      {/* Toast container */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
        {toasts.map(t => (
          <div
            key={t.id}
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg min-w-[280px] animate-in slide-in-from-right-5 fade-in duration-200",
              t.type === 'success' && "bg-primary text-primary-foreground",
              t.type === 'error' && "bg-red-600 text-white",
              t.type === 'loading' && "bg-muted text-foreground border border-border"
            )}
          >
            {t.type === 'success' && <CheckCircle className="w-5 h-5 shrink-0" />}
            {t.type === 'error' && <AlertCircle className="w-5 h-5 shrink-0" />}
            {t.type === 'loading' && <Loader2 className="w-5 h-5 shrink-0 animate-spin" />}
            
            <span className="text-sm font-medium flex-1">{t.message}</span>
            
            <button
              onClick={() => dismiss(t.id)}
              className="p-1 hover:bg-white/20 rounded transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
