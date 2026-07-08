import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, act, waitFor } from '@testing-library/react'
import { AuthProvider, useAuth } from './AuthContext'
import { mockSupabaseClient, authCallbacks, mockSession, mockProfile } from '@/test/setup'

function AuthConsumer() {
  const { user, profile, isLoading, isAdmin, signOut, refreshProfile, ensureSession } = useAuth()
  return (
    <div>
      <span data-testid="loading">{isLoading ? 'loading' : 'done'}</span>
      <span data-testid="user">{user?.email || 'no-user'}</span>
      <span data-testid="profile">{profile?.username || 'no-profile'}</span>
      <span data-testid="is-admin">{isAdmin ? 'admin' : 'user'}</span>
      <button onClick={signOut}>Sign Out</button>
      <button onClick={refreshProfile}>Refresh Profile</button>
      <button onClick={() => ensureSession()}>Ensure Session</button>
    </div>
  )
}

describe('AuthContext & AuthProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authCallbacks.length = 0
  })

  it('initializes session and profile on mount', async () => {
    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    )

    // Wait for the asynchronous profile fetch to complete
    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('done')
    })

    expect(screen.getByTestId('user')).toHaveTextContent(mockSession.user.email)
    expect(screen.getByTestId('profile')).toHaveTextContent(mockProfile.username)
    expect(screen.getByTestId('is-admin')).toHaveTextContent('user')
  })

  it('triggers signup and profile creation if profile is missing (PGRST116)', async () => {
    // Mock profiles select to return error code PGRST116 (does not exist)
    const selectMock = vi.fn().mockReturnThis()
    const eqMock = vi.fn().mockReturnThis()
    const singleMock = vi.fn().mockResolvedValueOnce({
      data: null,
      error: { code: 'PGRST116', message: 'No rows' },
    })
    
    // Mock upsert to succeed
    const upsertMock = vi.fn().mockReturnThis()
    const upsertSingleMock = vi.fn().mockResolvedValue({
      data: { ...mockProfile, username: 'test@example.com'.split('@')[0] },
      error: null,
    })

    mockSupabaseClient.from.mockImplementation((table) => {
      if (table === 'profiles') {
        return {
          select: selectMock,
          eq: eqMock,
          single: singleMock,
          upsert: upsertMock,
          then: (resolve: any) => resolve({ data: mockProfile, error: null }),
        }
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      }
    })

    // Also need to support chaining forupsert
    upsertMock.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      single: upsertSingleMock,
    })

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('done')
    })

    expect(screen.getByTestId('profile')).toHaveTextContent('test') // 'test' from test@example.com prefix
  })

  it('performs sign out successfully', async () => {
    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('done')
    })

    const signOutBtn = screen.getByText('Sign Out')
    
    act(() => {
      signOutBtn.click()
    })

    // Simulate SIGNOUT event coming from supabase auth state change listener
    if (authCallbacks.length > 0) {
      act(() => {
        authCallbacks[0]('SIGNED_OUT', null)
      })
    }

    expect(screen.getByTestId('user')).toHaveTextContent('no-user')
    expect(screen.getByTestId('profile')).toHaveTextContent('no-profile')
  })

  it('triggers session refresh on page visibility change to visible', async () => {
    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('done')
    })

    // Clear initial mock calls
    mockSupabaseClient.auth.refreshSession.mockClear()

    // Trigger tab visibility change
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      writable: true,
    })
    
    act(() => {
      window.dispatchEvent(new Event('visibilitychange'))
    })

    expect(mockSupabaseClient.auth.refreshSession).toHaveBeenCalled()
  })

  it('ensures session refresh is executed if token is close to expiry', async () => {
    // Simulate session expiring in 5 seconds
    const shortSession = {
      ...mockSession,
      expires_at: Math.floor(Date.now() / 1000) + 5,
    }

    mockSupabaseClient.auth.getSession.mockResolvedValueOnce({
      data: { session: shortSession },
      error: null,
    })

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('done')
    })

    mockSupabaseClient.auth.refreshSession.mockClear()

    // Trigger state update inside AuthProvider with shortSession
    act(() => {
      authCallbacks[0]('TOKEN_REFRESHED', shortSession)
    })

    const ensureSessionBtn = screen.getByText('Ensure Session')
    
    // Setup refreshSession mock
    mockSupabaseClient.auth.refreshSession.mockResolvedValueOnce({
      data: { session: mockSession },
      error: null,
    })

    await act(async () => {
      ensureSessionBtn.click()
    })

    expect(mockSupabaseClient.auth.refreshSession).toHaveBeenCalled()
  })
})
