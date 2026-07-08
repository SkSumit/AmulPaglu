import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  getProductShareData,
  getProfileShareData,
  getBadgeShareData,
  copyToClipboard,
  shareContent,
} from './share'

describe('Social Sharing Utility', () => {
  const originalNavigator = globalThis.navigator

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    globalThis.navigator = originalNavigator
  })

  it('getProductShareData formats product share texts correctly', () => {
    const product = {
      name: 'Amul Gold Milk | 1L Pack',
      points: 3,
      rarity_label: 'Rare',
    }
    const data = getProductShareData(product)

    expect(data.title).toBe('Amul Gold Milk')
    expect(data.text).toContain('Amul Gold Milk')
    expect(data.text).toContain('3 pts')
    expect(data.text).toContain('⭐⭐⭐')
    expect(data.url).toContain('/explore?search=Amul%20Gold%20Milk')
  })

  it('getProfileShareData formats profile share texts correctly', () => {
    const data = getProfileShareData('dairy_king', 240, 'Shrikhand Scholar', 15)

    expect(data.title).toBe("dairy_king's Profile")
    expect(data.text).toContain('Shrikhand Scholar')
    expect(data.text).toContain('15 products')
    expect(data.text).toContain('240 pts')
    expect(data.url).toContain('/profile/dairy_king')
  })

  it('getBadgeShareData formats badge share texts correctly', () => {
    const badge = {
      name: 'Calf Steps',
      icon: '🍼',
      description: 'Marked your very first Amul product as tried.',
    }
    const data = getBadgeShareData(badge)

    expect(data.title).toBe('Calf Steps')
    expect(data.text).toContain('Calf Steps')
    expect(data.text).toContain('🍼')
    expect(data.text).toContain('Marked your very first Amul product as tried.')
    expect(data.url).toContain('/profile')
  })

  it('copyToClipboard copies text using navigator.clipboard', async () => {
    const mockWriteText = vi.fn().mockResolvedValue(undefined)
    globalThis.navigator = {
      clipboard: {
        writeText: mockWriteText,
      },
    } as any

    const result = await copyToClipboard('Hello Share')
    expect(result).toBe(true)
    expect(mockWriteText).toHaveBeenCalledWith('Hello Share')
  })

  it('shareContent triggers navigator.share when available', async () => {
    const mockShare = vi.fn().mockResolvedValue(undefined)
    globalThis.navigator = {
      share: mockShare,
    } as any

    const addToastMock = vi.fn()
    const options = {
      title: 'Title',
      text: 'Text',
      url: 'http://example.com',
    }

    await shareContent(options, addToastMock)

    expect(mockShare).toHaveBeenCalledWith(options)
    expect(addToastMock).toHaveBeenCalledWith('Shared successfully!', 'success')
  })

  it('shareContent falls back to clipboard copy when navigator.share is unavailable', async () => {
    globalThis.navigator = {} as any // No share, no clipboard

    const addToastMock = vi.fn()
    const options = {
      title: 'Title',
      text: 'Text',
      url: 'http://example.com',
    }

    // Since clipboard is also undefined, we test clipboard fallback failure or success depending on elements
    // Let's mock a working clipboard in this test
    const mockWriteText = vi.fn().mockResolvedValue(undefined)
    globalThis.navigator = {
      clipboard: {
        writeText: mockWriteText,
      },
    } as any

    await shareContent(options, addToastMock)

    expect(mockWriteText).toHaveBeenCalledWith('Text\n\nCheck it out here: http://example.com')
    expect(addToastMock).toHaveBeenCalledWith('Link & details copied to clipboard!', 'success')
  })
})
