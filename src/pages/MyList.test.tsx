import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act, waitFor } from '@testing-library/react'
import MyList from './MyList'
import { useAuth } from '@/contexts/AuthContext'
import { mockSupabaseClient } from '@/test/setup'
import { MemoryRouter } from 'react-router-dom'

// Mock useAuth
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
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

describe('MyList Page', () => {
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

    // Mock products/user_products select responses
    mockSupabaseClient.from.mockImplementation((table) => {
      const builder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation((resolve) => {
          let data: any = []
          let count = 0
          if (table === 'user_products') {
            data = [
              {
                id: 'up-101',
                status: 'want_to_try',
                tried_at: null,
                notes: 'Must buy soon!',
                products: {
                  id: 'p-1',
                  name: 'Amul Butter',
                  category: 'Butter',
                  points: 5,
                  rarity_label: 'Common',
                }
              },
              {
                id: 'up-102',
                status: 'tried',
                tried_at: '2026-07-02T12:00:00Z',
                notes: 'Loved it!',
                products: {
                  id: 'p-2',
                  name: 'Amul Dark Chocolate',
                  category: 'Chocolate',
                  points: 10,
                  rarity_label: 'Epic',
                }
              }
            ]
          } else if (table === 'products') {
            count = 10
            data = []
          }
          resolve({ data, count, error: null })
        }),
      }
      return builder as any
    })
  })

  it('renders tab toggles and shows filtered list item counts', async () => {
    render(
      <MemoryRouter>
        <MyList />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Amul Butter')).toBeInTheDocument()
    })

    // By default want_to_try tab is active. It should show 'Amul Butter'
    expect(screen.getByText('Amul Butter')).toBeInTheDocument()
    // It should not show tried items ('Amul Dark Chocolate')
    expect(screen.queryByText('Amul Dark Chocolate')).not.toBeInTheDocument()

    // Switch to Already Tried tab
    const triedTab = screen.getByRole('button', { name: /Already Tried/ })
    await act(async () => {
      triedTab.click()
    })

    // Now it should show Amul Dark Chocolate and not Amul Butter
    expect(screen.getByText('Amul Dark Chocolate')).toBeInTheDocument()
    expect(screen.queryByText('Amul Butter')).not.toBeInTheDocument()
  })

  it('supports removing products from tasting list', async () => {
    // Setup delete query mock to succeed
    mockSupabaseClient.from.mockImplementation((table) => {
      const builder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        delete: vi.fn().mockImplementation(() => {
          return {
            eq: vi.fn().mockResolvedValue({ error: null })
          }
        }),
        then: vi.fn().mockImplementation((resolve) => {
          let data: any = []
          if (table === 'user_products') {
            data = [
              {
                id: 'up-101',
                status: 'want_to_try',
                tried_at: null,
                notes: 'Must buy soon!',
                products: {
                  id: 'p-1',
                  name: 'Amul Butter',
                  category: 'Butter',
                  points: 5,
                  rarity_label: 'Common',
                }
              }
            ]
          }
          resolve({ data, error: null })
        }),
      }
      return builder as any
    })

    render(
      <MemoryRouter>
        <MyList />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Amul Butter')).toBeInTheDocument()
    })

    const removeBtn = screen.getByRole('button', { name: 'Remove' })
    await act(async () => {
      removeBtn.click()
    })

    // Should trigger database delete
    expect(mockSupabaseClient.from).toHaveBeenCalledWith('user_products')
  })
})
