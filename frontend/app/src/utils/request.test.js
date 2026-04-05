import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { apiFetch, API_BASE } from '@/utils/request'

const mockFetch = vi.fn()
global.fetch = mockFetch
global.localStorage = {
  getItem: vi.fn(),
  removeItem: vi.fn()
}
global.window = {
  location: {
    pathname: '/',
    href: ''
  }
}

describe('apiFetch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.getItem.mockReturnValue(null)
    mockFetch.mockReset()
  })

  afterEach(() => {
    vi.resetModules()
  })

  it('should construct full URL correctly for relative paths', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ code: 200, data: {} })
    })

    await apiFetch('/api/test')

    expect(mockFetch).toHaveBeenCalledWith(
      `${API_BASE}/api/test`,
      expect.objectContaining({
        headers: expect.objectContaining({
          'Content-Type': 'application/json'
        })
      })
    )
  })

  it('should use absolute URL when provided', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ code: 200, data: {} })
    })

    await apiFetch('http://other.com/api/test')

    expect(mockFetch).toHaveBeenCalledWith(
      'http://other.com/api/test',
      expect.any(Object)
    )
  })

  it('should inject Authorization header when token exists', async () => {
    localStorage.getItem.mockReturnValue('test-token')

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ code: 200, data: {} })
    })

    await apiFetch('/api/test')

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          'Authorization': 'Bearer test-token'
        })
      })
    )
  })

  it('should not inject Authorization header when no token', async () => {
    localStorage.getItem.mockReturnValue(null)

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ code: 200, data: {} })
    })

    await apiFetch('/api/test')

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.not.objectContaining({
          'Authorization': expect.any(String)
        })
      })
    )
  })

  it('should handle 401 response with logout', async () => {
    window.location = { pathname: '/home', href: '' }

    mockFetch.mockResolvedValueOnce({
      status: 401,
      json: async () => ({ message: 'Unauthorized' })
    })

    await expect(apiFetch('/api/test')).rejects.toThrow('鐧诲綍宸茶繃鏈燂紝璇烽噸鏂扮櫥褰?)

    expect(localStorage.removeItem).toHaveBeenCalledWith('token')
    expect(localStorage.removeItem).toHaveBeenCalledWith('user')
    expect(localStorage.removeItem).toHaveBeenCalledWith('isAuthenticated')
  })

  it('should throw error on non-200 response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ code: 400, message: 'Bad request' })
    })

    await expect(apiFetch('/api/test')).rejects.toThrow('Bad request')
  })

  it('should throw error when response code is not 200', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ code: 500, message: 'Server error' })
    })

    await expect(apiFetch('/api/test')).rejects.toThrow('Server error')
  })

  it('should catch network errors', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'))

    await expect(apiFetch('/api/test')).rejects.toThrow('Network error')
  })

  it('should pass through request body', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ code: 200, data: {} })
    })

    const body = { username: 'test', password: '123' }
    await apiFetch('/api/login', { method: 'POST', body: JSON.stringify(body) })

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(body)
      })
    )
  })

  it('should return data on success', async () => {
    const mockData = { code: 200, data: { id: 1, name: 'test' } }
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockData
    })

    const result = await apiFetch('/api/test')

    expect(result).toEqual(mockData)
  })
})