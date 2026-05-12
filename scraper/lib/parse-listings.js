import { load } from 'cheerio'

const SEL = {
  card: 'a[href*="/ad/"]',
  title: '[data-q="listing-title"], h2.listing-title, .listing-title',
  price: '[data-q="listing-price"], .listing-price, .price',
  location: '[data-q="listing-location"], .listing-location, .location',
}

export function parseListings(html) {
  const $ = load(html)
  const listings = []
  const seen = new Set()

  $(SEL.card).each((_, el) => {
    const $el = $(el)
    const href = $el.attr('href') || ''
    const sourceListingId = extractId(href)
    if (!sourceListingId || seen.has(sourceListingId)) return
    seen.add(sourceListingId)

    const title = $el.find(SEL.title).first().text().trim()
      || $el.find('h2, h3').first().text().trim()
    if (!title) return

    listings.push({
      source: 'gumtree',
      source_listing_id: sourceListingId,
      title,
      price: extractPrice($el.find(SEL.price).first().text()),
      location_text: $el.find(SEL.location).first().text().trim() || null,
      url: href.startsWith('http') ? href : `https://www.gumtree.com${href}`,
      posted_at: null,
      raw_json: { snippet: $el.text().slice(0, 500) },
    })
  })

  return listings
}

function extractId(url) {
  if (!url) return null
  const m = url.match(/\/(\d{6,})(?:[/?#]|$)/)
  return m ? m[1] : null
}

function extractPrice(text) {
  if (!text) return null
  const m = text.replace(/[,£$€]/g, '').match(/[\d.]+/)
  return m ? parseFloat(m[0]) : null
}
