import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { X } from 'lucide-vue-next'
import DropdownButton from '@/components/common/DropdownButton.vue'

describe('DropdownButton.vue', () => {
  const mockItems = [
    { action: 'action1', label: 'Option 1' },
    { action: 'action2', label: 'Option 2' }
  ]

  it('should render button with icon', () => {
    const wrapper = mount(DropdownButton, {
      props: {
        icon: X,
        items: mockItems
      }
    })
    
    const button = wrapper.find('button')
    expect(button.exists()).toBe(true)
  })

  it('should not show dropdown menu initially', () => {
    const wrapper = mount(DropdownButton, {
      props: {
        icon: X,
        items: mockItems
      }
    })
    
    const menu = wrapper.find('div.absolute')
    expect(menu.exists()).toBe(false)
  })

  it('should show dropdown menu when button is clicked', async () => {
    vi.useFakeTimers()
    
    const wrapper = mount(DropdownButton, {
      props: {
        icon: X,
        items: mockItems
      }
    })
    
    const button = wrapper.find('button')
    await button.trigger('click')
    await vi.runAllTimersAsync()
    
    const menu = wrapper.find('div.absolute')
    expect(menu.exists()).toBe(true)
    
    vi.useRealTimers()
  })

  it('should emit select event with item and close menu', async () => {
    vi.useFakeTimers()
    
    const wrapper = mount(DropdownButton, {
      props: {
        icon: X,
        items: mockItems
      }
    })
    
    const button = wrapper.find('button')
    await button.trigger('click')
    await vi.runAllTimersAsync()
    
    const menuItems = wrapper.findAll('button.w-full')
    await menuItems[0].trigger('click')
    
    expect(wrapper.emitted('select')).toBeTruthy()
    expect(wrapper.emitted('select')[0]).toEqual([mockItems[0]])
    
    vi.useRealTimers()
  })

  it('should close menu when clicking outside', async () => {
    vi.useFakeTimers()
    
    const wrapper = mount(DropdownButton, {
      props: {
        icon: X,
        items: mockItems
      }
    })
    
    const button = wrapper.find('button')
    await button.trigger('click')
    await vi.runAllTimersAsync()
    
    const overlay = wrapper.find('div.fixed.inset-0')
    expect(overlay.exists()).toBe(true)
    
    await overlay.trigger('click')
    await wrapper.vm.$nextTick()
    
    const menu = wrapper.find('div.absolute')
    expect(menu.exists()).toBe(false)
    
    vi.useRealTimers()
  })

  it('should render all menu items', async () => {
    vi.useFakeTimers()
    
    const wrapper = mount(DropdownButton, {
      props: {
        icon: X,
        items: mockItems
      }
    })
    
    const button = wrapper.find('button')
    await button.trigger('click')
    await vi.runAllTimersAsync()
    
    const menuItems = wrapper.findAll('button.w-full')
    expect(menuItems.length).toBe(2)
    expect(menuItems[0].text()).toContain('Option 1')
    expect(menuItems[1].text()).toContain('Option 2')
    
    vi.useRealTimers()
  })
})