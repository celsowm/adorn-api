import { describe, it, expect } from 'vitest'
import { keys } from 'ts-transformer-keys'

interface UserProfile {
  id: number
  username: string
  email: string
  isAdmin?: boolean
}

describe('TypeScript Reflection', () => {
  it('should list all keys of the UserProfile interface at runtime', () => {
    const propertyKeys = keys<UserProfile>()

    expect(propertyKeys).toEqual(['id', 'username', 'email', 'isAdmin'])
    expect(propertyKeys).toContain('email')
  })
})
