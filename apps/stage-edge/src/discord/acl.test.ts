import { describe, expect, it } from 'vitest'

import { getUserRole, isAllowedInteraction, UserRole } from './acl'

describe('apps/stage-edge acl', () => {
  const config = {
    ownerId: 'owner_user_123',
    allowedUsers: ['friend_456', 'colleague_789'],
  }

  describe('getUserRole', () => {
    it('returns OWNER when userId matches ownerId', () => {
      expect(getUserRole('owner_user_123', config)).toBe(UserRole.OWNER)
    })

    it('returns DESIGNATED when userId is listed in allowedUsers', () => {
      expect(getUserRole('friend_456', config)).toBe(UserRole.DESIGNATED)
      expect(getUserRole('colleague_789', config)).toBe(UserRole.DESIGNATED)
    })

    it('returns VISITOR when userId is not owner and not in allowedUsers', () => {
      expect(getUserRole('stranger_000', config)).toBe(UserRole.VISITOR)
    })

    it('returns VISITOR when config has neither ownerId nor allowedUsers', () => {
      expect(getUserRole('any_user', {})).toBe(UserRole.VISITOR)
    })
  })

  describe('isAllowedInteraction', () => {
    it('returns true for OWNER and DESIGNATED roles', () => {
      expect(isAllowedInteraction('owner_user_123', config)).toBe(true)
      expect(isAllowedInteraction('friend_456', config)).toBe(true)
    })

    it('returns false for VISITOR roles', () => {
      expect(isAllowedInteraction('stranger_000', config)).toBe(false)
      expect(isAllowedInteraction('any_user', {})).toBe(false)
    })
  })
})
