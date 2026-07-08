import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { Navbar } from './Navbar'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { MemoryRouter } from 'react-router-dom'

// Mock contexts
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}))

vi.mock('@/contexts/ThemeContext', () => ({
  useTheme: vi.fn(),
}))

// Mock logo asset
vi.mock('@/assets/logo.png', () => ({
  default: 'mocked-logo.png',
}))

describe('Navbar Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useTheme).mockReturnValue({
      theme: 'light',
      toggleTheme: vi.fn(),
    })
  })

  it('renders landing page links when user is unauthenticated', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      profile: null,
      isAdmin: false,
      signOut: vi.fn(),
      refreshProfile: vi.fn(),
      ensureSession: vi.fn(),
    })

    render(
      <MemoryRouter>
        <Navbar />
      </MemoryRouter>
    )

    expect(screen.getByText('Sign In')).toBeInTheDocument()
    expect(screen.getByText('Sign up')).toBeInTheDocument()
    expect(screen.queryByText('Explore')).not.toBeInTheDocument()
  })

  it('renders navigation links and user profile dropdown when authenticated', () => {
    const mockSignOut = vi.fn()
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 'u1', email: 'john@example.com' } as any,
      profile: { id: 'u1', username: 'johndoe', total_points: 100 } as any,
      isAdmin: false,
      signOut: mockSignOut,
      refreshProfile: vi.fn(),
      ensureSession: vi.fn(),
    })

    render(
      <MemoryRouter>
        <Navbar />
      </MemoryRouter>
    )

    // Check link tabs are present
    expect(screen.getByText('Explore')).toBeInTheDocument()
    expect(screen.getByText('My List')).toBeInTheDocument()
    expect(screen.getByText('Leaderboard')).toBeInTheDocument()
    expect(screen.getByText('Suggest')).toBeInTheDocument()
    
    // Check user info is visible
    expect(screen.getByText('johndoe')).toBeInTheDocument()

    // Trigger profile dropdown
    const userMenuButton = screen.getByText('johndoe')
    act(() => {
      userMenuButton.click()
    })

    // Check menu options
    expect(screen.getByText('Profile')).toBeInTheDocument()
    const signOutBtn = screen.getByText('Sign out')
    expect(signOutBtn).toBeInTheDocument()

    // Trigger signout
    act(() => {
      signOutBtn.click()
    })
    expect(mockSignOut).toHaveBeenCalled()
  })

  it('renders Admin link for admin users', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 'u1' } as any,
      profile: { id: 'u1', username: 'adminuser', total_points: 500, is_admin: true } as any,
      isAdmin: true,
      signOut: vi.fn(),
      refreshProfile: vi.fn(),
      ensureSession: vi.fn(),
    })

    render(
      <MemoryRouter>
        <Navbar />
      </MemoryRouter>
    )

    // Admin links visible (both in desktop nav and drawer check)
    const adminLinks = screen.getAllByText('Admin')
    expect(adminLinks.length).toBeGreaterThan(0)
  })

  it('triggers theme toggling when button is clicked', () => {
    const toggleThemeMock = vi.fn()
    vi.mocked(useTheme).mockReturnValue({
      theme: 'light',
      toggleTheme: toggleThemeMock,
    })
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      profile: null,
      isAdmin: false,
      signOut: vi.fn(),
      refreshProfile: vi.fn(),
      ensureSession: vi.fn(),
    })

    render(
      <MemoryRouter>
        <Navbar />
      </MemoryRouter>
    )

    const toggleBtn = screen.getByLabelText('Toggle theme')
    act(() => {
      toggleBtn.click()
    })

    expect(toggleThemeMock).toHaveBeenCalled()
  })
})
