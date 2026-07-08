import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act, waitFor, fireEvent } from '@testing-library/react'
import Suggest from './Suggest'
import { useAuth } from '@/contexts/AuthContext'
import { mockSupabaseClient } from '@/test/setup'
import { MemoryRouter } from 'react-router-dom'
import userEvent from '@testing-library/user-event'

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

describe('Suggest Page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useAuth).mockReturnValue({
      session: { user: { id: 'test-user-id' } } as any,
      user: { id: 'test-user-id', email: 'test@example.com' } as any,
      profile: { id: 'test-user-id', username: 'testuser' } as any,
      isLoading: false,
      isAdmin: false,
      signOut: vi.fn(),
      refreshProfile: vi.fn(),
      ensureSession: vi.fn(),
    })

    // Default mock select response for past suggestions
    mockSupabaseClient.from.mockImplementation((table) => {
      const builder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        insert: vi.fn().mockResolvedValue({ error: null }),
        then: vi.fn().mockImplementation((resolve) => {
          let data: any = []
          if (table === 'suggestions') {
            data = [
              {
                id: 's-1',
                name: 'Amul Magic Cheese Spray',
                category: 'Cheese',
                status: 'pending',
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

  it('renders suggestion form and displays user suggestions history', async () => {
    render(
      <MemoryRouter>
        <Suggest />
      </MemoryRouter>
    )

    // Form header
    expect(screen.getByText('Suggest a Candidate')).toBeInTheDocument()

    // Suggestion history loading
    await waitFor(() => {
      expect(screen.getByText('Amul Magic Cheese Spray')).toBeInTheDocument()
    })

    // History stats
    expect(screen.getByText('In Quarantine')).toBeInTheDocument()
  })

  it('validates fields: checks name length and URL formats', async () => {
    const { container } = render(
      <MemoryRouter>
        <Suggest />
      </MemoryRouter>
    )

    const user = userEvent.setup()
    const form = container.querySelector('form')!

    // Submit empty form
    await act(async () => {
      fireEvent.submit(form)
    })
    expect(screen.getByText('Product name is required.')).toBeInTheDocument()

    // Submit too short name and invalid URLs
    const nameInput = screen.getByPlaceholderText(/Amul Garlic Butter/i)
    const imgUrlInput = screen.getByPlaceholderText(/Pencil in the photo link/i)
    const sourceUrlInput = screen.getByPlaceholderText(/amul.com/i)

    await user.type(nameInput, 'Ab')
    await user.type(imgUrlInput, 'invalid-url')
    await user.type(sourceUrlInput, 'another-bad-url')

    await act(async () => {
      fireEvent.submit(form)
    })

    expect(screen.getByText('Name must be at least 3 characters.')).toBeInTheDocument()
    expect(screen.getAllByText('Must be a valid URL starting with http(s)://').length).toBe(2)
  })

  it('inserts suggestion successfully into database', async () => {
    const user = userEvent.setup()

    const { container } = render(
      <MemoryRouter>
        <Suggest />
      </MemoryRouter>
    )

    const form = container.querySelector('form')!
    const nameInput = screen.getByPlaceholderText(/Amul Garlic Butter/i)
    const categorySelect = screen.getByRole('combobox')

    await user.type(nameInput, 'Amul Garlic Butter')
    await user.selectOptions(categorySelect, 'Butter')

    await act(async () => {
      fireEvent.submit(form)
    })

    expect(mockSupabaseClient.from).toHaveBeenCalledWith('suggestions')
    expect(addToastMock).toHaveBeenCalledWith(
      expect.stringContaining('Suggestion submitted!'),
      'success'
    )
  })
})
