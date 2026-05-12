export function matchesSearch(listing, search) {
  const haystack = (listing.title ?? '').toLowerCase().replace(/\s+/g, ' ')

  if (search.include_keywords?.length) {
    if (!search.include_keywords.every(kw => haystack.includes(kw.toLowerCase().trim()))) return false
  }
  if (search.exclude_keywords?.length) {
    if (search.exclude_keywords.some(kw => haystack.includes(kw.toLowerCase().trim()))) return false
  }
  if (search.min_price != null && listing.price != null && listing.price < search.min_price) return false
  if (search.max_price != null && listing.price != null && listing.price > search.max_price) return false

  return true
}
