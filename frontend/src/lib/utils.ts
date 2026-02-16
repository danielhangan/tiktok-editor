import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

// Session management
export function getSessionId(): string {
  let sessionId = localStorage.getItem('tiktok-editor-session')
  if (!sessionId) {
    sessionId = 'sess_' + crypto.randomUUID()
    localStorage.setItem('tiktok-editor-session', sessionId)
  }
  return sessionId
}

// API helper with session
export async function api(endpoint: string, options: RequestInit = {}) {
  const sessionId = getSessionId()
  const res = await fetch(endpoint, {
    ...options,
    headers: {
      ...options.headers,
      'X-Session-ID': sessionId,
    },
  })
  return res
}
