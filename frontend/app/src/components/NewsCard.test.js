import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { Eye } from 'lucide-vue-next'
import NewsCard from '@/components/NewsCard.vue'

describe('NewsCard.vue', () => {
  const mockItem = {
    id: 1,
    title: 'Test News Title',
    summary: 'Test summary text',
    thumbnail: 'https://example.com/image.jpg',
    date: '2024-01-01',
    views: 100
  }

  it('should render item title', () => {
    const wrapper = mount(NewsCard, {
      props: { item: mockItem }
    })
    
    const title = wrapper.find('h4')
    expect(title.exists()).toBe(true)
    expect(title.text()).toContain('Test News Title')
  })

  it('should render summary when showSummary is true', () => {
    const wrapper = mount(NewsCard, {
      props: { item: mockItem, showSummary: true }
    })
    
    const summary = wrapper.find('p')
    expect(summary.exists()).toBe(true)
    expect(summary.text()).toContain('Test summary text')
  })

  it('should not render summary when showSummary is false', () => {
    const wrapper = mount(NewsCard, {
      props: { item: mockItem, showSummary: false }
    })
    
    const summary = wrapper.find('p')
    expect(summary.exists()).toBe(false)
  })

  it('should render thumbnail when item has thumbnail', () => {
    const wrapper = mount(NewsCard, {
      props: { item: mockItem }
    })
    
    const img = wrapper.find('img')
    expect(img.exists()).toBe(true)
    expect(img.attributes('src')).toBe('https://example.com/image.jpg')
  })

  it('should not render thumbnail when item has no thumbnail', () => {
    const itemWithoutThumbnail = { ...mockItem, thumbnail: null }
    const wrapper = mount(NewsCard, {
      props: { item: itemWithoutThumbnail }
    })
    
    const img = wrapper.find('img')
    expect(img.exists()).toBe(false)
  })

  it('should render date', () => {
    const wrapper = mount(NewsCard, {
      props: { item: mockItem }
    })
    
    const dateSpan = wrapper.findAll('span')[0]
    expect(dateSpan.text()).toBe('2024-01-01')
  })

  it('should render views when item has views', () => {
    const wrapper = mount(NewsCard, {
      props: { item: mockItem }
    })
    
    const viewsSpan = wrapper.findAll('span')[1]
    expect(viewsSpan.text()).toContain('100')
    expect(viewsSpan.findComponent(Eye).exists()).toBe(true)
  })

  it('should not render views when item has no views', () => {
    const itemWithoutViews = { ...mockItem, views: null }
    const wrapper = mount(NewsCard, {
      props: { item: itemWithoutViews }
    })
    
    const viewsSpans = wrapper.findAll('span')
    expect(viewsSpans.length).toBe(1)
  })

  it('should emit click event when clicked', async () => {
    const wrapper = mount(NewsCard, {
      props: { item: mockItem }
    })
    
    const card = wrapper.find('div.card-base')
    await card.trigger('click')
    
    expect(wrapper.emitted('click')).toBeTruthy()
  })
})