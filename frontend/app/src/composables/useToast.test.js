import { describe, it, expect } from 'vitest'
import { showToast, useToast } from '@/composables/useToast'

describe('useToast', () => {
  it('should export showToast function', () => {
    expect(typeof showToast).toBe('function')
  })

  it('should export useToast function', () => {
    expect(typeof useToast).toBe('function')
  })

  it('useToast should return reactive state', () => {
    const { message, visible, duration } = useToast()
    
    expect(message.value).toBe('')
    expect(visible.value).toBe(false)
    expect(duration.value).toBe(2000)
  })
})