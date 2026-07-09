import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import ProfilePage from './Profile'
import { useAuth } from '@/contexts/AuthContext'
import { mockSupabaseClient } from '@/test/setup'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

// Mock useAuth
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}))

// Mock BadgesSection
vi.mock('@/components/badges/BadgesSection', () => ({
  BadgesSection: () => <div data-testid="mock-badges-section">Mock Badges Section</div>
}))

// Mock ProductImage
vi.mock('@/components/products/ProductImage', () => ({
  ProductImage: () => <div data-testid="mock-product-image">Product Image</div>
}))

// Mock logo asset
vi.mock('@/assets/logo.png', () => ({
  default: 'mocked-logo.png',
}))

describe('Profile Page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useAuth).mockReturnValue({
      session: { user: { id: 'test-user-id' } } as any,
      user: { id: 'test-user-id', email: 'test@example.com' } as any,
      profile: { id: 'test-user-id', username: 'testuser', total_points: 10 } as any,
      isLoading: false,
      isAdmin: false,
      signOut: vi.fn(),
      refreshProfile: vi.fn(),
      ensureSession: vi.fn(),
    })
  })

  it('renders "User not found" if profile does not exist', async () => {
    mockSupabaseClient.from.mockImplementationOnce(() => {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValueOnce({ data: null, error: new Error('User not found') }),
      } as any
    })

    render(
      <MemoryRouter initialEntries={['/profile/unknown_user']}>
        <Routes>
          <Route path="/profile/:username" element={<ProfilePage />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('User not found')).toBeInTheDocument()
    })
  })

  it('renders public profile stats, level, tried list, and unlocked badges', async () => {
    mockSupabaseClient.from.mockImplementation((table) => {
      const builder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        gt: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValueOnce({
          data: { id: 'user-456', username: 'butter_king', total_points: 120 },
          error: null
        }),
        then: vi.fn().mockImplementation((resolve) => {
          let data: any = []
          let count = 0
          if (table === 'user_products') {
            data = [
              {
                tried_at: '2026-07-02T10:00:00Z',
                products: { id: 'p-1', name: 'Amul Butter Premium', category: 'Butter' }
              }
            ]
            count = 1
          } else if (table === 'profiles') {
            count = 1 // for rank
          } else if (table === 'badges' || table === 'user_badges') {
            data = []
          }
          resolve({ data, count, error: null })
        }),
      }
      return builder as any
    })

    render(
      <MemoryRouter initialEntries={['/profile/butter_king']}>
        <Routes>
          <Route path="/profile/:username" element={<ProfilePage />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('butter_king')).toBeInTheDocument()
    })

    // Level badge check (120 points maps to Shrikhand Scholar)
    expect(screen.getByText(/Shrikhand Scholar/)).toBeInTheDocument()

    // Tried list entry check
    expect(screen.getByText('Amul Butter Premium')).toBeInTheDocument()
    expect(screen.getByTestId('mock-badges-section')).toBeInTheDocument()
  })
})
