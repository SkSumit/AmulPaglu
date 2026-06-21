import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { supabase } from '@/lib/supabase'

async function bootstrap() {
  // Pre-warm: force token refresh to complete BEFORE React mounts.
  // Without this, React StrictMode's double-effect causes a navigator.locks
  // deadlock — the first onAuthStateChange subscription acquires the refresh
  // lock, cleanup releases the subscription but not the lock, and the second
  // subscription waits for a lock that never releases.
  // Timeout at 8 s so a cold/paused project doesn't hang indefinitely.
  try {
    await Promise.race([
      supabase.auth.getSession(),
      new Promise<void>((resolve) => setTimeout(resolve, 8000)),
    ])
  } catch {
    // Ignore — AuthContext handles the resulting auth state
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

bootstrap()
