import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act, waitFor } from '@testing-library/react'
import Login from './Login'
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

// Mock ForgotPassword component
vi.mock('@/components/ui/ForgotPassword', () => ({
  ForgotPassword: () => <div data-testid="mock-forgot-password">Forgot Password Content</div>,
}))

describe('Login Page', () => {
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

  it('redirects to dashboard if user already has an active session', () => {
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
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<div>Dashboard Content</div>} />
        </Routes>
      </MemoryRouter>
    )

    expect(screen.getByText('Dashboard Content')).toBeInTheDocument()
  })

  it('renders login form and checks input validations', async () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    )

    expect(screen.getByText('Welcome back')).toBeInTheDocument()
    const emailInput = screen.getByLabelText('Email')
    const passwordInput = screen.getByLabelText('Password')
    const submitBtn = screen.getByRole('button', { name: 'Sign in' })

    // Submitting empty form shows validation error
    act(() => {
      submitBtn.click()
    })
    expect(screen.getByText('Please fill in all fields.')).toBeInTheDocument()

    // Filling only email shows same error
    await act(async () => {
      await userEvent.type(emailInput, 'john@example.com')
      submitBtn.click()
    })
    expect(screen.getByText('Please fill in all fields.')).toBeInTheDocument()
  })

  it('calls Supabase auth.signInWithPassword on submit and navigates on success', async () => {
    mockSupabaseClient.auth.signInWithPassword.mockResolvedValueOnce({
      data: { session: {} },
      error: null,
    })

    render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<div>Dashboard Content</div>} />
        </Routes>
      </MemoryRouter>
    )

    const emailInput = screen.getByLabelText('Email')
    const passwordInput = screen.getByLabelText('Password')
    const submitBtn = screen.getByRole('button', { name: 'Sign in' })

    await act(async () => {
      await userEvent.type(emailInput, 'john@example.com')
      await userEvent.type(passwordInput, 'validpassword')
      submitBtn.click()
    })

    expect(mockSupabaseClient.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'john@example.com',
      password: 'validpassword',
    })

    await waitFor(() => {
      expect(screen.getByText('Dashboard Content')).toBeInTheDocument()
    })
  })

  it('shows friendly error messages if auth fails', async () => {
    mockSupabaseClient.auth.signInWithPassword.mockResolvedValueOnce({
      data: { session: null },
      error: new Error('Invalid login credentials'),
    })

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    )

    const emailInput = screen.getByLabelText('Email')
    const passwordInput = screen.getByLabelText('Password')
    const submitBtn = screen.getByRole('button', { name: 'Sign in' })

    await act(async () => {
      await userEvent.type(emailInput, 'john@example.com')
      await userEvent.type(passwordInput, 'wrongpass')
      submitBtn.click()
    })

    await waitFor(() => {
      expect(screen.getByText(/Wrong email or password/i)).toBeInTheDocument()
    })
  })

  it('toggles Forgot Password mode when clicking the link', () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    )

    const forgotBtn = screen.getByText('Forgot password?')
    act(() => {
      forgotBtn.click()
    })

    expect(screen.getByTestId('mock-forgot-password')).toBeInTheDocument()
    expect(screen.getByText('Reset your password')).toBeInTheDocument()
  })
})
