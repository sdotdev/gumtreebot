export function buildGumtreeUrl(search) {
  const params = new URLSearchParams()
  params.set('q', search.query_text)
  if (search.location_text) params.set('search_location', search.location_text)
  if (search.category) params.set('search_category', search.category)
  if (search.min_price != null) params.set('min_price', String(search.min_price))
  if (search.max_price != null) params.set('max_price', String(search.max_price))
  params.set('sort', 'date')
  return `https://www.gumtree.com/search?${params.toString()}`
}
