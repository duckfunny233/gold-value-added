import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { AuthService } from '@/services/auth'

vi.mock('@/utils/request', () => ({
  apiFetch: vi.fn()
}))

import { apiFetch } from '@/utils/request'

describe('AuthService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.localStorage = {
      getItem: vi.fn(),
      removeItem: vi.fn(),
      setItem: vi.fn()
    }
  })

  afterEach(() => {
    delete global.localStorage
  })

  describe('login', () => {
    it('should call login API with correct parameters', async () => {
      const mockResponse = { code: 200, data: { token: 'abc' } }
      apiFetch.mockResolvedValueOnce(mockResponse)

      const result = await AuthService.login('username', 'password')

      expect(apiFetch).toHaveBeenCalledWith(
        '/api/auth/login',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ username: 'username', password: 'password' })
        })
      )
      expect(result).toEqual(mockResponse)
    })
  })

  describe('register', () => {
    it('should call register API with user data', async () => {
      const userData = {
        username: 'testuser',
        password: 'password123',
        phone: '1234567890',
        code: '123456'
      }
      const mockResponse = { code: 200, data: { id: 1 } }
      apiFetch.mockResolvedValueOnce(mockResponse)

      const result = await AuthService.register(userData)

      expect(apiFetch).toHaveBeenCalledWith(
        '/api/auth/register',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(userData)
        })
      )
      expect(result).toEqual(mockResponse)
    })
  })

  describe('sendOtp', () => {
    it('should call send-otp API with phone number', async () => {
      const mockResponse = { code: 200, message: 'OTP sent' }
      apiFetch.mockResolvedValueOnce(mockResponse)

      const result = await AuthService.sendOtp('1234567890')

      expect(apiFetch).toHaveBeenCalledWith(
        '/api/auth/send-otp',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ phone: '1234567890' })
        })
      )
      expect(result).toEqual(mockResponse)
    })
  })

  describe('resetPassword', () => {
    it('should call reset-password API with data', async () => {
      const data = {
        phone: '1234567890',
        code: '123456',
        password: 'newpassword'
      }
      const mockResponse = { code: 200, message: 'Password reset' }
      apiFetch.mockResolvedValueOnce(mockResponse)

      const result = await AuthService.resetPassword(data)

      expect(apiFetch).toHaveBeenCalledWith(
        '/api/auth/reset-password',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(data)
        })
      )
      expect(result).toEqual(mockResponse)
    })
  })

  describe('logout', () => {
    it('should call logout API and clear localStorage', async () => {
      const mockResponse = { code: 200 }
      apiFetch.mockResolvedValueOnce(mockResponse)

      await AuthService.logout()

      expect(apiFetch).toHaveBeenCalledWith(
        '/api/auth/logout',
        expect.objectContaining({ method: 'POST' })
      )
      expect(localStorage.removeItem).toHaveBeenCalledWith('token')
      expect(localStorage.removeItem).toHaveBeenCalledWith('user')
      expect(localStorage.removeItem).toHaveBeenCalledWith('isAuthenticated')
    })

    it('should clear localStorage even if API fails', async () => {
      apiFetch.mockRejectedValueOnce(new Error('Network error'))

      await AuthService.logout()

      expect(localStorage.removeItem).toHaveBeenCalledWith('token')
      expect(localStorage.removeItem).toHaveBeenCalledWith('user')
      expect(localStorage.removeItem).toHaveBeenCalledWith('isAuthenticated')
    })
  })

  describe('isAuthenticated', () => {
    it('should return true when token exists', () => {
      localStorage.getItem.mockReturnValue('some-token')

      expect(AuthService.isAuthenticated()).toBe(true)
    })

    it('should return false when token does not exist', () => {
      localStorage.getItem.mockReturnValue(null)

      expect(AuthService.isAuthenticated()).toBe(false)
    })
  })
})
