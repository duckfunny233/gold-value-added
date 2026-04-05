import { describe, it, expect, vi } from 'vitest'
import { ref, nextTick } from 'vue'
import { useChatScroll } from '@/composables/useChatScroll'

describe('useChatScroll', () => {
  it('should return scrollToBottom and handleLoadMoreScroll functions', () => {
    const containerRef = ref(null)
    const { scrollToBottom, handleLoadMoreScroll } = useChatScroll(containerRef)
    
    expect(typeof scrollToBottom).toBe('function')
    expect(typeof handleLoadMoreScroll).toBe('function')
  })

  it('should scroll container to bottom', async () => {
    const containerRef = ref({
      scrollTop: 0,
      scrollHeight: 500
    })
    
    const { scrollToBottom } = useChatScroll(containerRef)
    await scrollToBottom()
    
    expect(containerRef.value.scrollTop).toBe(500)
  })

  it('should not throw when container is null', async () => {
    const containerRef = ref(null)
    
    const { scrollToBottom, handleLoadMoreScroll } = useChatScroll(containerRef)
    
    await expect(scrollToBottom()).resolves.not.toThrow()
    await expect(handleLoadMoreScroll(100)).resolves.not.toThrow()
  })

  it('should maintain scroll position after loading more', async () => {
    const containerRef = ref({
      scrollTop: 100,
      scrollHeight: 500
    })
    const oldHeight = 500
    
    const { handleLoadMoreScroll } = useChatScroll(containerRef)
    await handleLoadMoreScroll(oldHeight)
    
    const newHeight = containerRef.value.scrollHeight
    expect(containerRef.value.scrollTop).toBe(newHeight - oldHeight)
  })

  it('should await nextTick before scrolling', async () => {
    const scrollHeight = 1000
    const containerRef = ref({
      scrollTop: 0,
      get scrollHeight() {
        return scrollHeight
      }
    })
    
    const { scrollToBottom } = useChatScroll(containerRef)
    
    let scrollCalled = false
    const originalScrollTop = Object.getOwnPropertyDescriptor(containerRef.value, 'scrollTop')
    Object.defineProperty(containerRef.value, 'scrollTop', {
      set: () => { scrollCalled = true },
      get: () => 0
    })
    
    const promise = scrollToBottom()
    expect(scrollCalled).toBe(false)
    
    await promise
  })
})