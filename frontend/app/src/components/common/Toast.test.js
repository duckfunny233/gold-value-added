import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import Toast from '@/components/common/Toast.vue'

describe('Toast.vue', () => {
  it('should not render when visible is false', () => {
    const wrapper = mount(Toast, {
      props: {
        message: 'Test message',
        visible: false,
        duration: 2000
      }
    })
    
    expect(wrapper.find('div').exists()).toBe(false)
  })

  it('should render when visible is true', () => {
    const wrapper = mount(Toast, {
      props: {
        message: 'Test message',
        visible: true,
        duration: 2000
      }
    })
    
    expect(wrapper.find('div').exists()).toBe(true)
    expect(wrapper.text()).toContain('Test message')
  })

  it('should use default props', () => {
    const wrapper = mount(Toast)
    
    expect(wrapper.props('message')).toBe('')
    expect(wrapper.props('visible')).toBe(false)
    expect(wrapper.props('duration')).toBe(2000)
  })

  it('should render transition element', () => {
    const wrapper = mount(Toast, {
      props: {
        message: 'Test',
        visible: true,
        duration: 2000
      }
    })
    
    const transition = wrapper.findComponent({ name: 'Transition' })
    expect(transition.exists()).toBe(true)
  })
})