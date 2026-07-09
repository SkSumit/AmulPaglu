import { getDisplayProductName } from './utils'
import { logger } from './logger'

interface ShareOptions {
  title: string
  text: string
  url: string
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
    // Fallback for older browsers / insecure contexts
    const textArea = document.createElement('textarea')
    textArea.value = text
    textArea.style.position = 'fixed'
    textArea.style.opacity = '0'
    document.body.appendChild(textArea)
    textArea.focus()
    textArea.select()
    const successful = document.execCommand('copy')
    document.body.removeChild(textArea)
    return successful
  } catch (err) {
    logger.error('Clipboard copy failed:', err)
    return false
  }
}

export async function shareContent(
  options: ShareOptions,
  addToast: (msg: string, type: 'success' | 'error') => void
) {
  const shareTextCombined = `${options.text}\n\nCheck it out here: ${options.url}`

  if (navigator.share) {
    try {
      await navigator.share({
        title: options.title,
        text: options.text,
        url: options.url,
      })
      addToast('Shared successfully!', 'success')
      return
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        logger.error('Web share failed:', err)
      } else {
        // User cancelled native share, do nothing
        return
      }
    }
  }

  // Fallback to Clipboard Copy
  const copied = await copyToClipboard(shareTextCombined)
  if (copied) {
    addToast('Link & details copied to clipboard!', 'success')
  } else {
    addToast('Failed to copy share link.', 'error')
  }
}

export function getProductShareData(product: { name: string; points: number | null; rarity_label: string | null }) {
  const displayName = getDisplayProductName(product.name)
  const stars = '⭐'.repeat(product.points ?? 1)
  const text = `🥛 I tracked down "${displayName}" (${product.points ?? 1} pt${product.points !== 1 ? 's' : ''} ${stars}) on Amul Tracker!`
  const url = `${window.location.origin}/explore?search=${encodeURIComponent(displayName)}`
  return { title: displayName, text, url }
}

export function getProfileShareData(username: string, totalPoints: number, tierLabel: string, triedCount: number) {
  const text = `👑 I'm officially a "${tierLabel}" on Amul Tracker!\n\n✅ Tried: ${triedCount} products\n⭐ Points: ${totalPoints} pts`
  const url = `${window.location.origin}/profile/${encodeURIComponent(username)}`
  return { title: `${username}'s Profile`, text, url }
}

export function getBadgeShareData(badge: { name: string; icon: string; description?: string | null }) {
  const text = `🏅 I unlocked the "${badge.name}" badge ${badge.icon} on Amul Tracker!\n\n"${badge.description || ''}"`
  const url = `${window.location.origin}/profile`
  return { title: badge.name, text, url }
}
