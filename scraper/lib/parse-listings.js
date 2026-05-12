import { load } from 'cheerio'

export function parseListings(html) {
  try {
    const $ = load(html)
    const listings = []
    const seen = new Set()

    $('[data-q="search-result"]').each((_, article) => {
      const $a = $(article).find('[data-q="search-result-anchor"]').first()
      const href = $a.attr('href') || ''
      if (!href) return

      const url = href.startsWith('http') ? href : `https://www.gumtree.com${href}`
      const sourceListingId = extractId(href)
      if (!sourceListingId || seen.has(sourceListingId)) return
      seen.add(sourceListingId)

      const title = $(article).find('[data-q="tile-title"]').first().text().trim()
      if (!title) return

      const priceText = $(article).find('[data-q="tile-price"]').first().text().trim()
      const locationText = $(article).find('[data-q="tile-location"]').first().text().trim() || null
      const $desc = $(article).find('[data-q="tile-description"]').first().clone()
      $desc.find('style, script').remove()
      const description = $desc.text().trim() || null

      listings.push({
        source: 'gumtree',
        source_listing_id: sourceListingId,
        title,
        price: extractPrice(priceText),
        location_text: locationText,
        url,
        posted_at: null,
        raw_json: {
          description,
          price_text: priceText || null,
        },
      })
    })

    return listings
  } catch (err) {
    console.error('Error parsing listings:', err.message, err.stack)
    // Return empty array to avoid breaking the pipeline
    return []
  }
}

function extractId(url) {
  const m = url.match(/\/(\d{6,})(?:[/?#]|$)/)
  return m ? m[1] : null
}

function extractPrice(text) {
  if (!text) return null
  const m = text.replace(/[,£$€\s]/g, '').match(/\d+(\.\d+)?/)
  return m ? parseFloat(m[0]) : null
}
