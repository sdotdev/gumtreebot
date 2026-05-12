export async function fetchPage(url, retries = 3) {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-GB,en;q=0.9',
    'Cache-Control': 'no-cache',
  }
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, { headers })
      if (res.ok) return res.text()
      if (res.status === 429) {
        await sleep(5000 * (i + 1))
        continue
      }
    } catch (err) {
      if (i === retries - 1) throw err
    }
    await sleep(1000 * Math.pow(2, i))
  }
  throw new Error(`Failed to fetch ${url} after ${retries} attempts`)
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }
