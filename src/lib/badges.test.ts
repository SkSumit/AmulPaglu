import { describe, it, expect, vi, beforeEach } from 'vitest'
import { checkAndAwardBadges, revokeBadgesIfNeeded } from './badges'
import { mockSupabaseClient } from '@/test/setup'

describe('badges RPC helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('checkAndAwardBadges', () => {
    it('calls get_and_clear_new_badges RPC and formats unlocked badges', async () => {
      const mockResult = [
        {
          new_icon: '🏆',
          new_name: 'Super Taster',
          new_description: 'Tried 5 products',
        },
      ]
      mockSupabaseClient.rpc.mockResolvedValueOnce({ data: mockResult, error: null })

      const result = await checkAndAwardBadges('user-123')

      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith('get_and_clear_new_badges', {
        p_user_id: 'user-123',
      })
      expect(result).toEqual([
        {
          icon: '🏆',
          name: 'Super Taster',
          description: 'Tried 5 products',
        },
      ])
    })

    it('returns empty array if RPC returns error', async () => {
      mockSupabaseClient.rpc.mockResolvedValueOnce({ data: null, error: new Error('RPC Error') })
      const result = await checkAndAwardBadges('user-123')
      expect(result).toEqual([])
    })

    it('returns empty array if exception occurs', async () => {
      mockSupabaseClient.rpc.mockRejectedValueOnce(new Error('Network break'))
      const result = await checkAndAwardBadges('user-123')
      expect(result).toEqual([])
    })
  })

  describe('revokeBadgesIfNeeded', () => {
    it('calls revoke_unearned_badges RPC', async () => {
      mockSupabaseClient.rpc.mockResolvedValueOnce({ error: null })
      await revokeBadgesIfNeeded('user-123')
      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith('revoke_unearned_badges', {
        p_user_id: 'user-123',
      })
    })

    it('silently catches RPC errors', async () => {
      mockSupabaseClient.rpc.mockRejectedValueOnce(new Error('Network break'))
      await expect(revokeBadgesIfNeeded('user-123')).resolves.not.toThrow()
    })
  })
})
