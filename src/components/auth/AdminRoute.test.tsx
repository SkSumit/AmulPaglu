import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AdminRoute } from './AdminRoute'
import { useAuth } from '@/contexts/AuthContext'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

// Mock useAuth
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}))

describe('AdminRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders loading spinner when loading is true', () => {
    vi.mocked(useAuth).mockReturnValue({
      session: null,
      isLoading: true,
      user: null,
      profile: null,
      isAdmin: false,
      signOut: vi.fn(),
      refreshProfile: vi.fn(),
      ensureSession: vi.fn(),
    })

    render(
      <MemoryRouter initialEntries={['/admin']}>
        <AdminRoute>
          <div>Admin Content</div>
        </AdminRoute>
      </MemoryRouter>
    )

    expect(screen.queryByText('Admin Content')).not.toBeInTheDocument()
    expect(document.querySelector('.animate-spin')).toBeInTheDocument()
  })

  it('redirects to /dashboard if user is not an admin', () => {
    vi.mocked(useAuth).mockReturnValue({
      session: { user: { id: 'u1' } } as any,
      isLoading: false,
      user: { id: 'u1' } as any,
      profile: { id: 'u1', username: 'user1', is_admin: false } as any,
      isAdmin: false,
      signOut: vi.fn(),
      refreshProfile: vi.fn(),
      ensureSession: vi.fn(),
    })

    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route path="/dashboard" element={<div>Dashboard Page</div>} />
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <div>Admin Content</div>
              </AdminRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    )

    expect(screen.queryByText('Admin Content')).not.toBeInTheDocument()
    expect(screen.getByText('Dashboard Page')).toBeInTheDocument()
  })

  it('renders admin content if user is verified admin', () => {
    vi.mocked(useAuth).mockReturnValue({
      session: { user: { id: 'u1' } } as any,
      isLoading: false,
      user: { id: 'u1' } as any,
      profile: { id: 'u1', username: 'admin1', is_admin: true } as any,
      isAdmin: true,
      signOut: vi.fn(),
      refreshProfile: vi.fn(),
      ensureSession: vi.fn(),
    })

    render(
      <MemoryRouter initialEntries={['/admin']}>
        <AdminRoute>
          <div>Admin Content</div>
        </AdminRoute>
      </MemoryRouter>
    )

    expect(screen.getByText('Admin Content')).toBeInTheDocument()
  })
})
