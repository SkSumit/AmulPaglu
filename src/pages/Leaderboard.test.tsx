import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import Leaderboard from './Leaderboard'
import { useAuth } from '@/contexts/AuthContext'
import { mockSupabaseClient } from '@/test/setup'
import { MemoryRouter } from 'react-router-dom'

// Mock useAuth
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}))

describe('Leaderboard Page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useAuth).mockReturnValue({
      session: { user: { id: 'test-user-id' } } as any,
      user: { id: 'test-user-id', email: 'test@example.com' } as any,
      profile: { id: 'test-user-id', username: 'testuser', total_points: 100 } as any,
      isLoading: false,
      isAdmin: false,
      signOut: vi.fn(),
      refreshProfile: vi.fn(),
      ensureSession: vi.fn(),
    })

    // Setup select mock for profiles leaderboard and user_products counts
    mockSupabaseClient.from.mockImplementation((table) => {
      const builder = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation((resolve) => {
          let data: any = []
          let count = 0
          if (table === 'profiles') {
            count = 2
            data = [
              { id: 'u1', username: 'lactose_legend', total_points: 250 },
              { id: 'test-user-id', username: 'testuser', total_points: 100 },
            ]
          } else if (table === 'user_products') {
            count = 5
            data = []
          }
          resolve({ data, count, error: null })
        }),
      }
      return builder as any
    })
  })

  it('renders top ranked user profiles and highlights the current user profile', async () => {
    render(
      <MemoryRouter>
        <Leaderboard />
      </MemoryRouter>
    )

    // Header title
    expect(screen.getByText(/Leaderboard/i)).toBeInTheDocument()

    // Wait for data load
    await waitFor(() => {
      expect(screen.getByText('lactose_legend')).toBeInTheDocument()
    })

    expect(screen.getByText('testuser (you)')).toBeInTheDocument()
  })
})
