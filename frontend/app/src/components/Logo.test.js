import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import Logo from '@/components/Logo.vue'
import LogoLarge from '@/components/LogoLarge.vue'

describe('Logo.vue', () => {
  it('should render logo image', () => {
    const wrapper = mount(Logo)
    
    const img = wrapper.find('img')
    expect(img.exists()).toBe(true)
    expect(img.attributes('alt')).toBe('Logo')
    expect(img.classes()).toContain('w-12')
    expect(img.classes()).toContain('h-12')
  })

  it('should render logo text', () => {
    const wrapper = mount(Logo)
    
    const text = wrapper.find('span')
    expect(text.exists()).toBe(true)
    expect(text.text()).toContain('閲戝奖瀛愰粍閲戝鍊?)
  })

  it('should have correct layout classes', () => {
    const wrapper = mount(Logo)
    
    const container = wrapper.find('div')
    expect(container.classes()).toContain('flex')
    expect(container.classes()).toContain('items-center')
    expect(container.classes()).toContain('gap-2')
  })
})

describe('LogoLarge.vue', () => {
  it('should render large logo image', () => {
    const wrapper = mount(LogoLarge)
    
    const img = wrapper.find('img')
    expect(img.exists()).toBe(true)
    expect(img.attributes('alt')).toBe('Logo')
    expect(img.classes()).toContain('w-48')
    expect(img.classes()).toContain('h-48')
  })

  it('should render Chinese text', () => {
    const wrapper = mount(LogoLarge)
    
    const spans = wrapper.findAll('span')
    expect(spans[0].text()).toContain('閲戝奖瀛愰粍閲戝鍊?)
  })

  it('should render English text', () => {
    const wrapper = mount(LogoLarge)
    
    const spans = wrapper.findAll('span')
    expect(spans[1].text()).toContain('GOLD VALUE ADDED')
  })

  it('should have correct layout classes', () => {
    const wrapper = mount(LogoLarge)
    
    const container = wrapper.find('div')
    expect(container.classes()).toContain('flex')
    expect(container.classes()).toContain('flex-col')
    expect(container.classes()).toContain('items-center')
  })
})