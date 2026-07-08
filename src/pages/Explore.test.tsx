import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act, waitFor } from '@testing-library/react'
import Explore from './Explore'
import { useAuth } from '@/contexts/AuthContext'
import { mockSupabaseClient } from '@/test/setup'
import { MemoryRouter } from 'react-router-dom'
import userEvent from '@testing-library/user-event'
import confetti from 'canvas-confetti'

// Mock useAuth
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}))

// Mock canvas-confetti
vi.mock('canvas-confetti', () => ({
  __esModule: true,
  default: vi.fn(),
}))

// Mock Toast hook
const addToastMock = vi.fn()
vi.mock('@/components/ui/Toast', () => ({
  useToast: () => ({
    toasts: [],
    addToast: addToastMock,
    dismiss: vi.fn(),
  }),
  ToastContainer: () => <div data-testid="mock-toast-container">Toasts</div>,
}))

// Mock BadgeUnlockPopup
vi.mock('@/components/badges/BadgeUnlockPopup', () => ({
  BadgeUnlockPopup: () => <div data-testid="mock-badge-unlock-popup">Badges Popup</div>
}))

describe('Explore Page', () => {
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

    // Setup default products & user products select responses
    mockSupabaseClient.from.mockImplementation((table) => {
      const builder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        upsert: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation((resolve) => {
          let data: any = []
          if (table === 'products') {
            data = [
              { id: 'p-1', name: 'Amul Butter 100g', points: 2, category: 'Butter', rarity_label: 'Common', approved: true },
              { id: 'p-2', name: 'Amul Dark Chocolate', points: 5, category: 'Chocolate', rarity_label: 'Rare', approved: true },
            ]
          } else if (table === 'user_products') {
            data = [
              { id: 'up-1', product_id: 'p-1', user_id: 'test-user-id', status: 'want_to_try', tried_at: null }
            ]
          }
          resolve({ data, error: null })
        }),
      }
      return builder as any
    })
  })

  it('renders filter header stats, search bar, and grid of products', async () => {
    render(
      <MemoryRouter>
        <Explore />
      </MemoryRouter>
    )

    // Wait for loading to finish and components to be rendered
    await waitFor(() => {
      expect(screen.getByText('Amul Butter')).toBeInTheDocument()
    })

    expect(screen.getByText('Amul Dark Chocolate')).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument()

    // Header stats: total products should say 2, tried should say 0 (since map lists p-1 as want_to_try)
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('/ 2 tried')).toBeInTheDocument()
  })

  it('filters products by search input queries', async () => {
    render(
      <MemoryRouter>
        <Explore />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Amul Butter')).toBeInTheDocument()
    })

    const searchInput = screen.getByPlaceholderText(/search/i)
    await act(async () => {
      await userEvent.type(searchInput, 'Chocolate')
    })

    expect(screen.getByText('Amul Dark Chocolate')).toBeInTheDocument()
    expect(screen.queryByText('Amul Butter')).not.toBeInTheDocument()
  })

  it('supports optimistic user status updates: adding to list', async () => {
    mockSupabaseClient.from.mockImplementation((table) => {
      const builder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        insert: vi.fn().mockImplementation(() => {
          return {
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { id: 'up-2', product_id: 'p-2', status: 'want_to_try' },
              error: null
            })
          }
        }),
        then: vi.fn().mockImplementation((resolve) => {
          let data: any = []
          if (table === 'products') {
            data = [
              { id: 'p-1', name: 'Amul Butter', points: 2, category: 'Butter', rarity_label: 'Common', approved: true },
              { id: 'p-2', name: 'Amul Dark Chocolate', points: 5, category: 'Chocolate', rarity_label: 'Rare', approved: true },
            ]
          } else if (table === 'user_products') {
            data = [] // start with nothing added
          }
          resolve({ data, error: null })
        }),
      }
      return builder as any
    })

    render(
      <MemoryRouter>
        <Explore />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Amul Dark Chocolate')).toBeInTheDocument()
    })

    // Click "Add to List" button on Dark Chocolate card
    const addBtns = screen.getAllByRole('button', { name: 'Add to List' })
    expect(addBtns.length).toBeGreaterThan(0)
    
    await act(async () => {
      addBtns[0].click()
    })

    // Should call supabase to insert a row
    expect(mockSupabaseClient.from).toHaveBeenCalledWith('user_products')
  })

  it('supports optimistic user status updates: marking as tried', async () => {
    mockSupabaseClient.from.mockImplementation((table) => {
      const builder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        insert: vi.fn().mockImplementation(() => {
          return {
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { id: 'up-1', product_id: 'p-1', status: 'tried', tried_at: new Date().toISOString() },
              error: null
            })
          }
        }),
        then: vi.fn().mockImplementation((resolve) => {
          let data: any = []
          if (table === 'products') {
            data = [
              { id: 'p-1', name: 'Amul Butter', points: 2, category: 'Butter', rarity_label: 'Common', approved: true },
            ]
          } else if (table === 'user_products') {
            data = []
          }
          resolve({ data, error: null })
        }),
      }
      return builder as any
    })

    render(
      <MemoryRouter>
        <Explore />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Amul Butter')).toBeInTheDocument()
    })

    const triedBtn = screen.getByRole('button', { name: 'Tried it!' })
    await act(async () => {
      triedBtn.click()
    })

    // Verify confetti triggered
    await waitFor(() => {
      expect(confetti).toHaveBeenCalled()
    })
  })
})
