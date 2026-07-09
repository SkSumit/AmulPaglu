import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act, waitFor } from '@testing-library/react'
import Signup from './Signup'
import { useAuth } from '@/contexts/AuthContext'
import { mockSupabaseClient } from '@/test/setup'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import userEvent from '@testing-library/user-event'

// Mock useAuth
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}))

// Mock logo asset
vi.mock('@/assets/logo.png', () => ({
  default: 'mocked-logo.png',
}))

describe('Signup Page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useAuth).mockReturnValue({
      session: null,
      isLoading: false,
      user: null,
      profile: null,
      isAdmin: false,
      signOut: vi.fn(),
      refreshProfile: vi.fn(),
      ensureSession: vi.fn(),
    })
  })

  it('redirects to dashboard if user has active session', () => {
    vi.mocked(useAuth).mockReturnValue({
      session: { user: { id: 'u1' } } as any,
      isLoading: false,
      user: { id: 'u1' } as any,
      profile: null,
      isAdmin: false,
      signOut: vi.fn(),
      refreshProfile: vi.fn(),
      ensureSession: vi.fn(),
    })

    render(
      <MemoryRouter initialEntries={['/signup']}>
        <Routes>
          <Route path="/signup" element={<Signup />} />
          <Route path="/dashboard" element={<div>Dashboard Content</div>} />
        </Routes>
      </MemoryRouter>
    )

    expect(screen.getByText('Dashboard Content')).toBeInTheDocument()
  })

  it('performs client side validation checks', async () => {
    render(
      <MemoryRouter>
        <Signup />
      </MemoryRouter>
    )

    const signupBtn = screen.getByRole('button', { name: 'Create account' })
    act(() => {
      signupBtn.click()
    })

    expect(screen.getByText('Username is required.')).toBeInTheDocument()
    expect(screen.getByText('Email is required.')).toBeInTheDocument()
    expect(screen.getByText('Password is required.')).toBeInTheDocument()
    expect(screen.getByText('Please confirm your password.')).toBeInTheDocument()
  })

  it('validates regex rules and mismatched passwords', async () => {
    render(
      <MemoryRouter>
        <Signup />
      </MemoryRouter>
    )

    const user = userEvent.setup()
    await act(async () => {
      await user.type(screen.getByLabelText('Username'), 'ab') // too short
      await user.type(screen.getByLabelText('Email'), 'invalid-email')
      await user.type(screen.getByLabelText('Password'), '123') // too short
      await user.type(screen.getByLabelText('Confirm password'), '1234') // mismatch
      screen.getByRole('button', { name: 'Create account' }).click()
    })

    expect(screen.getByText('3–20 chars, letters, numbers, and underscores only.')).toBeInTheDocument()
    expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument()
    expect(screen.getByText('Password must be at least 8 characters.')).toBeInTheDocument()
    expect(screen.getByText('Passwords do not match.')).toBeInTheDocument()
  })

  it('triggers Supabase auth and updates user profile on success', async () => {
    const user = userEvent.setup()
    mockSupabaseClient.auth.signUp.mockResolvedValueOnce({
      data: { user: { id: 'new-user-123' } },
      error: null,
    })
    
    mockSupabaseClient.from.mockImplementationOnce((table) => {
      expect(table).toBe('profiles')
      return {
        upsert: vi.fn().mockResolvedValue({ error: null })
      } as any
    })

    render(
      <MemoryRouter initialEntries={['/signup']}>
        <Routes>
          <Route path="/signup" element={<Signup />} />
          <Route path="/dashboard" element={<div>Dashboard Content</div>} />
        </Routes>
      </MemoryRouter>
    )

    await act(async () => {
      await user.type(screen.getByLabelText('Username'), 'valid_user')
      await user.type(screen.getByLabelText('Email'), 'test@example.com')
      await user.type(screen.getByLabelText('Password'), 'strongpassword123')
      await user.type(screen.getByLabelText('Confirm password'), 'strongpassword123')
      screen.getByRole('button', { name: 'Create account' }).click()
    })

    expect(mockSupabaseClient.auth.signUp).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'strongpassword123',
      options: {
        data: { username: 'valid_user' },
      },
    })

    await waitFor(() => {
      expect(screen.getByText('Dashboard Content')).toBeInTheDocument()
    })
  })
})
