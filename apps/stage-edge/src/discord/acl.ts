/**
 * Access Control List (ACL) permission matrix for Edge Relay.
 * Distinguishes System Owner, Designated Users, and General Visitors.
 */

export interface AclConfig {
  ownerId?: string
  allowedUsers?: string[]
}

export enum UserRole {
  OWNER = 'OWNER',
  DESIGNATED = 'DESIGNATED',
  VISITOR = 'VISITOR',
}

export function getUserRole(userId: string, config: AclConfig): UserRole {
  if (config.ownerId && userId === config.ownerId) {
    return UserRole.OWNER
  }
  if (config.allowedUsers && config.allowedUsers.includes(userId)) {
    return UserRole.DESIGNATED
  }
  return UserRole.VISITOR
}

export function isAllowedInteraction(userId: string, config: AclConfig): boolean {
  const role = getUserRole(userId, config)
  return role === UserRole.OWNER || role === UserRole.DESIGNATED
}
