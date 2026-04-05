import { ref, nextTick } from 'vue'

export function useChatScroll(containerRef) {
  const scrollToBottom = async () => {
    await nextTick()
    if (containerRef.value) {
      containerRef.value.scrollTop = containerRef.value.scrollHeight
    }
  }

  const handleLoadMoreScroll = async (oldHeight) => {
    await nextTick()
    if (containerRef.value) {
      const newHeight = containerRef.value.scrollHeight
      containerRef.value.scrollTop = newHeight - oldHeight
    }
  }

  return {
    scrollToBottom,
    handleLoadMoreScroll
  }
}