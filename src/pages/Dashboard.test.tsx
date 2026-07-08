import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import Dashboard from './Dashboard'
import { useAuth } from '@/contexts/AuthContext'
import { mockSupabaseClient } from '@/test/setup'
import { MemoryRouter } from 'react-router-dom'

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

describe('Dashboard Page', () => {
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

  it('renders loading skeleton while auth is loading', () => {
    vi.mocked(useAuth).mockReturnValue({
      session: null,
      user: null,
      profile: null,
      isLoading: true,
      isAdmin: false,
      signOut: vi.fn(),
      refreshProfile: vi.fn(),
      ensureSession: vi.fn(),
    })

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    )

    // Skeletons or loader should be present
    expect(screen.queryByText('Butter Enthusiast')).not.toBeInTheDocument()
  })

  it('displays user profile level tier and calculated stats on successful load', async () => {
    // Mock the parallel database queries
    // Order of mock resolutions matches the Promise.all calls in loadDashboard
    mockSupabaseClient.from.mockImplementation((table) => {
      const builder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        gt: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation((resolve) => {
          let data: any = []
          let count = 0
          if (table === 'products') {
            count = 10
            data = []
          } else if (table === 'user_products') {
            count = 3
            // Mock tried points for live total
            data = [{ products: { points: 5 } }, { products: { points: 5 } }]
          } else if (table === 'profiles') {
            count = 1 // for rankCount
            data = []
          } else if (table === 'badges') {
            data = []
          } else if (table === 'user_badges') {
            data = []
          }
          resolve({ data, count, error: null })
        }),
      }
      return builder as any
    })

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    )

    // Wait for dashboard to resolve loading
    await waitFor(() => {
      expect(screen.getByText('testuser')).toBeInTheDocument()
    })

    // Level description and rank should be visible
    expect(screen.getByText('#2')).toBeInTheDocument()
    expect(screen.getByText('10')).toBeInTheDocument() // Points
    expect(screen.getByText('Lactose Trainee')).toBeInTheDocument() // Tier name for 10 points
    expect(screen.getByTestId('mock-badges-section')).toBeInTheDocument()
  })
})
