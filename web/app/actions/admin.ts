'use server'
import { load } from 'cheerio'

const SEL = {
  card: 'a[href*="/ad/"]',
  title: '[data-q="listing-title"], h2.listing-title, .listing-title',
  price: '[data-q="listing-price"], .listing-price, .price',
  location: '[data-q="listing-location"], .listing-location, .location',
}

export async function parseHtmlAction(html: string): Promise<object[]> {
  const $ = load(html)
  const listings: object[] = []
  const seen = new Set<string>()

  $(SEL.card).each((_, el) => {
    const $el = $(el)
    const href = $el.attr('href') || ''
    const m = href.match(/\/(\d{6,})(?:[/?#]|$)/)
    const id = m?.[1]
    if (!id || seen.has(id)) return
    seen.add(id)
    const title =
      $el.find(SEL.title).first().text().trim() ||
      $el.find('h2, h3').first().text().trim()
    if (!title) return
    listings.push({
      id,
      title,
      price: $el.find(SEL.price).first().text().trim() || null,
      location: $el.find(SEL.location).first().text().trim() || null,
      url: href.startsWith('http') ? href : `https://www.gumtree.com${href}`,
    })
  })

  return listings
}
