import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act, waitFor } from '@testing-library/react'
import ResetPassword from './ResetPassword'
import { mockSupabaseClient } from '@/test/setup'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import userEvent from '@testing-library/user-event'

// Mock logo asset
vi.mock('@/assets/logo.png', () => ({
  default: 'mocked-logo.png',
}))

describe('ResetPassword Page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders reset password form and checks input validations', async () => {
    render(
      <MemoryRouter>
        <ResetPassword />
      </MemoryRouter>
    )

    expect(screen.getByText('Reset your password')).toBeInTheDocument()
    const passwordInput = screen.getByPlaceholderText('New password')
    const confirmInput = screen.getByPlaceholderText('Confirm New password')
    const submitBtn = screen.getByRole('button', { name: 'Update Password' })

    const user = userEvent.setup()

    // Test password too short
    await act(async () => {
      await user.type(passwordInput, '123')
      await user.type(confirmInput, '123')
      submitBtn.click()
    })
    expect(screen.getByText('Password must be at least 6 characters')).toBeInTheDocument()

    // Clear inputs and test mismatch
    await act(async () => {
      await user.clear(passwordInput)
      await user.clear(confirmInput)
      await user.type(passwordInput, 'validpass123')
      await user.type(confirmInput, 'mismatchpass')
      submitBtn.click()
    })
    expect(screen.getByText('Passwords do not match')).toBeInTheDocument()
  })

  it('calls Supabase auth.updateUser on submit and redirects on success', async () => {
    const user = userEvent.setup()
    mockSupabaseClient.auth.updateUser.mockResolvedValueOnce({
      error: null,
    })

    render(
      <MemoryRouter initialEntries={['/reset-password']}>
        <Routes>
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/login" element={<div>Login Page Content</div>} />
        </Routes>
      </MemoryRouter>
    )

    const passwordInput = screen.getByPlaceholderText('New password')
    const confirmInput = screen.getByPlaceholderText('Confirm New password')
    const submitBtn = screen.getByRole('button', { name: 'Update Password' })

    await act(async () => {
      await user.type(passwordInput, 'newpassword123')
      await user.type(confirmInput, 'newpassword123')
      submitBtn.click()
    })

    expect(mockSupabaseClient.auth.updateUser).toHaveBeenCalledWith({
      password: 'newpassword123',
    })

    await waitFor(() => {
      expect(screen.getByText('Login Page Content')).toBeInTheDocument()
    })
  })
})
