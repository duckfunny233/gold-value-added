import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useMarketPolling } from '@/composables/useMarketPolling'
import * as marketService from '@/services/market'

vi.mock('@/services/market', () => ({
  MarketService: {
    getPrices: vi.fn(() => Promise.resolve({ data: [] }))
  }
}))

describe('useMarketPolling', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should export useMarketPolling function', () => {
    expect(typeof useMarketPolling).toBe('function')
  })

  it('should accept interval parameter', () => {
    expect(() => useMarketPolling(5000)).not.toThrow()
  })
})