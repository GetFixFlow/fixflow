import { describe, it, expect, beforeEach } from 'vitest'
import { useAuthStore } from '@/stores/authStore'

const mockUser = {
  id: 1,
  email: 'admin@demo.com',
  full_name: 'Demo Admin',
  role: 'admin' as const,
  organization_id: 1,
  created_at: new Date().toISOString(),
}

describe('authStore', () => {
  beforeEach(() => {
    useAuthStore.getState().clearAuth()
  })

  it('starts unauthenticated', () => {
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
    expect(useAuthStore.getState().user).toBeNull()
  })

  it('setAuth sets user and token', () => {
    useAuthStore.getState().setAuth(mockUser, 'test-token')
    const state = useAuthStore.getState()
    expect(state.isAuthenticated).toBe(true)
    expect(state.user).toEqual(mockUser)
    expect(state.token).toBe('test-token')
  })

  it('clearAuth resets state', () => {
    useAuthStore.getState().setAuth(mockUser, 'test-token')
    useAuthStore.getState().clearAuth()
    const state = useAuthStore.getState()
    expect(state.isAuthenticated).toBe(false)
    expect(state.user).toBeNull()
  })

  it('updateUser merges partial update', () => {
    useAuthStore.getState().setAuth(mockUser, 'test-token')
    useAuthStore.getState().updateUser({ full_name: 'Updated Name' })
    expect(useAuthStore.getState().user?.full_name).toBe('Updated Name')
    expect(useAuthStore.getState().user?.email).toBe('admin@demo.com')
  })
})
