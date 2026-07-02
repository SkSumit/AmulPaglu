import { useState, useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { checkAndAwardBadges } from '@/lib/badges'
import { BadgeUnlockPopup, type UnlockedBadge } from '@/components/badges/BadgeUnlockPopup'
import { Navbar } from './Navbar'

/** Main layout for all user-facing pages. */
export function Layout() {
  const { user } = useAuth()
  const [unlockedBadges, setUnlockedBadges] = useState<UnlockedBadge[]>([])

  useEffect(() => {
    if (!user) return
    let active = true
    // Wait a brief moment to let page transitions complete before showing achievements
    const timer = setTimeout(async () => {
      const unlocked = await checkAndAwardBadges(user.id)
      if (unlocked.length > 0 && active) {
        setUnlockedBadges(unlocked)
      }
    }, 1200)

    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [user])

  return (
    <div className="flex min-h-screen flex-col bg-[hsl(var(--background))]">
      <Navbar />
      <main className="flex-1 page-transition">
        <Outlet />
      </main>

      {unlockedBadges.length > 0 && (
        <BadgeUnlockPopup badges={unlockedBadges} onClose={() => setUnlockedBadges([])} />
      )}
    </div>
  )
}
