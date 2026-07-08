import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act, waitFor } from '@testing-library/react'
import AdminOverview from './AdminOverview'
import AdminSuggestions from './AdminSuggestions'
import { mockSupabaseClient } from '@/test/setup'
import { MemoryRouter } from 'react-router-dom'

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

// Mock ProductImage
vi.mock('@/components/products/ProductImage', () => ({
  ProductImage: () => <div data-testid="mock-product-image">Product Image</div>
}))

describe('Admin Overview Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSupabaseClient.from.mockImplementation((table) => {
      const builder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation((resolve) => {
          let count = 0
          if (table === 'products') count = 10
          else if (table === 'profiles') count = 5
          else if (table === 'user_products') count = 3
          else if (table === 'suggestions') count = 2
          resolve({ count, data: [], error: null })
        }),
      }
      return builder as any
    })
  })

  it('renders overall dashboard statistics correctly', async () => {
    render(
      <MemoryRouter>
        <AdminOverview />
      </MemoryRouter>
    )

    expect(screen.getByText('Overview')).toBeInTheDocument()
    expect(screen.getByText('Platform health at a glance')).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText('Total products')).toBeInTheDocument()
    })
    
    // The numbers mapped should be loaded into the StatCards
    expect(screen.getAllByText('10').length).toBeGreaterThan(0)
    expect(screen.getAllByText('5').length).toBeGreaterThan(0)
  })
})

describe('Admin Suggestions Moderation Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSupabaseClient.from.mockImplementation((table) => {
      const builder = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        update: vi.fn().mockImplementation(() => {
          return {
            eq: vi.fn().mockResolvedValue({ error: null })
          }
        }),
        insert: vi.fn().mockResolvedValue({ error: null }),
        then: vi.fn().mockImplementation((resolve) => {
          let data: any = []
          if (table === 'suggestions') {
            data = [
              {
                id: 's-201',
                name: 'Amul Chocolate Spray',
                category: 'Dairy',
                status: 'pending',
                submitted_by: 'u-1',
                created_at: new Date().toISOString(),
              }
            ]
          }
          resolve({ data, error: null })
        }),
      }
      return builder as any
    })
  })

  it('renders pending suggestions and supports approval flows', async () => {
    render(
      <MemoryRouter>
        <AdminSuggestions />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Amul Chocolate Spray')).toBeInTheDocument()
    })

    // Click the expand chevron button (the first button without text content)
    const expandBtn = screen.getAllByRole('button').filter(btn => !btn.textContent)[0]
    await act(async () => {
      expandBtn.click()
    })

    const approveBtn = screen.getByRole('button', { name: /Approve & create/i })
    expect(approveBtn).toBeInTheDocument()

    await act(async () => {
      approveBtn.click()
    })

    // Approval inserts products and updates suggestion row
    expect(mockSupabaseClient.from).toHaveBeenCalledWith('products')
    expect(mockSupabaseClient.from).toHaveBeenCalledWith('suggestions')
    expect(addToastMock).toHaveBeenCalledWith('✅ Approved & product created!', 'success')
  })
})
