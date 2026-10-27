import { createClient } from '@supabase/supabase-js'
import { isExpiredAuthError, SESSION_EXPIRED_EVENT } from './auth-errors'

const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()
const rememberSessionKey = 'agrolico.inventory.remember-session'

const sessionAwareFetch: typeof fetch = async (input, init) => {
  const response = await globalThis.fetch(input, init)
  if (response.status === 401 && typeof window !== 'undefined') {
    response
      .clone()
      .text()
      .then((body) => {
        if (isExpiredAuthError(body))
          window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT))
      })
      .catch(() => undefined)
  }
  return response
}

export function getRememberSessionPreference() {
  return typeof window !== 'undefined' && window.localStorage.getItem(rememberSessionKey) === 'true'
}

export function setRememberSessionPreference(remember: boolean) {
  if (typeof window === 'undefined') return
  if (remember) window.localStorage.setItem(rememberSessionKey, 'true')
  else window.localStorage.removeItem(rememberSessionKey)
}

const authStorage = {
  getItem(key: string) {
    if (typeof window === 'undefined') return null
    const storage = getRememberSessionPreference() ? window.localStorage : window.sessionStorage
    return storage.getItem(key)
  },
  setItem(key: string, value: string) {
    if (typeof window === 'undefined') return
    const persistent = getRememberSessionPreference()
    const storage = persistent ? window.localStorage : window.sessionStorage
    const alternateStorage = persistent ? window.sessionStorage : window.localStorage
    storage.setItem(key, value)
    alternateStorage.removeItem(key)
  },
  removeItem(key: string) {
    if (typeof window === 'undefined') return
    window.localStorage.removeItem(key)
    window.sessionStorage.removeItem(key)
  },
}

export const hasSupabaseConfig = Boolean(url && anonKey)
export const supabase = hasSupabaseConfig
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: authStorage,
      },
      global: { fetch: sessionAwareFetch },
    })
  : null
