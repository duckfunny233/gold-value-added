import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'

vi.mock('klinecharts', () => ({
  init: vi.fn(() => ({
    setStyles: vi.fn(),
    applyNewData: vi.fn()
  })),
  dispose: vi.fn()
}))

import { init, dispose } from 'klinecharts'
import KLineChart from '@/components/KLineChart.vue'

describe('KLineChart.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  it('should initialize chart on mount', () => {
    mount(KLineChart)
    
    expect(init).toHaveBeenCalled()
  })

  it('should apply data when provided on mount', () => {
    const mockData = [
      { timestamp: 1000, open: 100, high: 110, low: 90, close: 105, volume: 1000 }
    ]
    
    mount(KLineChart, {
      props: { data: mockData }
    })
    
    const chartInstance = init.mock.results[0].value
    expect(chartInstance.applyNewData).toHaveBeenCalledWith(mockData)
  })

  it('should update styles when type changes', async () => {
    const wrapper = mount(KLineChart, {
      props: { type: 'candle' }
    })
    
    await wrapper.setProps({ type: 'area' })
    
    const chartInstance = init.mock.results[0].value
    expect(chartInstance.setStyles).toHaveBeenCalled()
  })

  it('should apply new data when data prop changes', async () => {
    const mockData1 = [{ timestamp: 1000, open: 100, high: 110, low: 90, close: 105 }]
    const mockData2 = [{ timestamp: 2000, open: 105, high: 115, low: 95, close: 110 }]
    
    const wrapper = mount(KLineChart, {
      props: { data: mockData1 }
    })
    
    await wrapper.setProps({ data: mockData2 })
    
    const chartInstance = init.mock.results[0].value
    expect(chartInstance.applyNewData).toHaveBeenCalledWith(mockData2)
  })

  it('should dispose chart on unmount', () => {
    const wrapper = mount(KLineChart)
    
    wrapper.unmount()
    
    expect(dispose).toHaveBeenCalled()
  })

  it('should have correct default props', () => {
    const wrapper = mount(KLineChart)
    
    expect(wrapper.props('data')).toEqual([])
    expect(wrapper.props('type')).toBe('candle')
  })

  it('should render container element', () => {
    const wrapper = mount(KLineChart)
    
    const container = wrapper.find('.w-full')
    expect(container.exists()).toBe(true)
  })

  it('should not apply data when data is empty', () => {
    mount(KLineChart, {
      props: { data: [] }
    })
    
    const chartInstance = init.mock.results[0].value
    expect(chartInstance.applyNewData).not.toHaveBeenCalled()
  })
})