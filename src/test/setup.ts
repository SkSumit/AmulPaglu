import { vi } from 'vitest'
import '@testing-library/jest-dom'

// Mock canvas-confetti
vi.mock('canvas-confetti', () => ({
  __esModule: true,
  default: vi.fn(),
}))

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Setup global Supabase database & auth mocks
export const mockSession = {
  access_token: 'mock-access-token',
  refresh_token: 'mock-refresh-token',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  token_type: 'bearer',
  user: {
    id: 'test-user-id',
    email: 'test@example.com',
    user_metadata: { username: 'testuser' },
    app_metadata: {},
    aud: 'authenticated',
    created_at: new Date().toISOString(),
  },
}

export const mockProfile = {
  id: 'test-user-id',
  username: 'testuser',
  total_points: 150,
  is_admin: false,
  created_at: new Date().toISOString(),
}

// Keep track of auth callbacks
export const authCallbacks: ((event: string, session: any) => void)[] = []

export const mockSupabaseClient = {
  auth: {
    getSession: vi.fn().mockResolvedValue({ data: { session: mockSession }, error: null }),
    getUser: vi.fn().mockResolvedValue({ data: { user: mockSession.user }, error: null }),
    signUp: vi.fn().mockResolvedValue({ data: { user: mockSession.user, session: mockSession }, error: null }),
    signInWithPassword: vi.fn().mockResolvedValue({ data: { user: mockSession.user, session: mockSession }, error: null }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    updateUser: vi.fn().mockResolvedValue({ error: null }),
    refreshSession: vi.fn().mockResolvedValue({ data: { session: mockSession }, error: null }),
    onAuthStateChange: vi.fn().mockImplementation((cb) => {
      authCallbacks.push(cb)
      // Call cb immediately with the initial auth state
      cb('INITIAL_SESSION', mockSession)
      return {
        data: {
          subscription: {
            unsubscribe: () => {
              const idx = authCallbacks.indexOf(cb)
              if (idx !== -1) authCallbacks.splice(idx, 1)
            },
          },
        },
      }
    }),
  },
  from: vi.fn().mockImplementation((table) => {
    const builder = {
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      then: vi.fn().mockImplementation((resolve) => {
        let data: any = []
        if (table === 'profiles') {
          data = mockProfile
        } else if (table === 'products') {
          data = [
            { id: 'p1', name: 'Amul Butter', points: 10, category: 'Butter', rarity: 'Common', approved: true },
            { id: 'p2', name: 'Amul Gold Milk', points: 20, category: 'Milk', rarity: 'Epic', approved: true },
          ]
        } else if (table === 'user_products') {
          data = [
            { id: 'up1', user_id: 'test-user-id', product_id: 'p1', status: 'tried', rating: 4, notes: 'Delicious!' }
          ]
        } else if (table === 'suggestions') {
          data = []
        }
        resolve({ data, error: null })
      }),
    }
    
    builder.single.mockImplementation(() => {
      if (table === 'profiles') {
        return Promise.resolve({ data: mockProfile, error: null })
      }
      return Promise.resolve({ data: null, error: null })
    })

    return builder
  }),
  rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => mockSupabaseClient,
}))
