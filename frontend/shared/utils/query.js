export function toQueryString(params = {}) {
  const search = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value !== '' && value !== undefined && value !== null) {
      search.set(key, value)
    }
  })

  const text = search.toString()
  return text ? `?${text}` : ''
}
