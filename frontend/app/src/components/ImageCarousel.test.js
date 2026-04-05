import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'
import ImageCarousel from '@/components/ImageCarousel.vue'

describe('ImageCarousel.vue', () => {
  const mockItems = ['item1', 'item2', 'item3']

  it('should render correct number of items', () => {
    const wrapper = mount(ImageCarousel, {
      props: { items: mockItems }
    })
    
    const itemDivs = wrapper.findAll('div.aspect-\\[16\\/10\\]')
    expect(itemDivs.length).toBe(3)
  })

  it('should render default slot content', () => {
    const wrapper = mount(ImageCarousel, {
      props: { items: mockItems }
    })
    
    expect(wrapper.text()).toContain('绮惧僵鎺ㄨ崘 1')
    expect(wrapper.text()).toContain('绮惧僵鎺ㄨ崘 2')
    expect(wrapper.text()).toContain('绮惧僵鎺ㄨ崘 3')
  })

  it('should render custom slot content', () => {
    const wrapper = mount(ImageCarousel, {
      props: { items: mockItems },
      slots: {
        default: '<div class="custom-slot">Custom Content</div>'
      }
    })
    
    expect(wrapper.find('div.custom-slot').exists()).toBe(true)
  })

  it('should show arrows when showArrows is true and items exist', () => {
    const wrapper = mount(ImageCarousel, {
      props: { items: mockItems, showArrows: true }
    })
    
    expect(wrapper.findComponent(ChevronLeft).exists()).toBe(true)
    expect(wrapper.findComponent(ChevronRight).exists()).toBe(true)
  })

  it('should hide arrows when showArrows is false', () => {
    const wrapper = mount(ImageCarousel, {
      props: { items: mockItems, showArrows: false }
    })
    
    expect(wrapper.findComponent(ChevronLeft).exists()).toBe(false)
    expect(wrapper.findComponent(ChevronRight).exists()).toBe(false)
  })

  it('should hide arrows when items are empty', () => {
    const wrapper = mount(ImageCarousel, {
      props: { items: [], showArrows: true }
    })
    
    expect(wrapper.findComponent(ChevronLeft).exists()).toBe(false)
    expect(wrapper.findComponent(ChevronRight).exists()).toBe(false)
  })

  it('should hide scrollbar when showScrollbar is false', () => {
    const wrapper = mount(ImageCarousel, {
      props: { items: mockItems, showScrollbar: false }
    })
    
    const container = wrapper.find('.overflow-x-auto')
    expect(container.classes()).toContain('scrollbar-hide')
  })

  it('should show scrollbar when showScrollbar is true', () => {
    const wrapper = mount(ImageCarousel, {
      props: { items: mockItems, showScrollbar: true }
    })
    
    const container = wrapper.find('.overflow-x-auto')
    expect(container.classes()).toContain('custom-scrollbar')
  })

  it('should have correct default props', () => {
    const wrapper = mount(ImageCarousel)
    
    expect(wrapper.props('items')).toEqual([1, 2, 3, 4, 5])
    expect(wrapper.props('showArrows')).toBe(true)
    expect(wrapper.props('showScrollbar')).toBe(true)
  })
})