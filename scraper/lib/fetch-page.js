function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

export async function fetchPage(url, maxRetries = 3) {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-GB,en;q=0.9',
    'Cache-Control': 'no-cache',
  }

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 15000)

      const res = await fetch(url, {
        headers,
        signal: controller.signal
      })
      clearTimeout(timeoutId)

      if (res.ok) {
        return res.text()
      }

      // Rate limited - wait longer before retry
      if (res.status === 429) {
        const retryAfter = parseInt(res.headers.get('retry-after') || '5', 10)
        const delay = retryAfter * 1000
        if (attempt < maxRetries - 1) {
          console.log(`[fetch-page] Rate limited (429), waiting ${delay}ms before retry`)
          await sleep(delay)
          continue
        }
      }

      // Client errors - don't retry
      if (res.status >= 400 && res.status < 500) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`)
      }

      // Server errors - retry with backoff
      if (attempt < maxRetries - 1) {
        const delay = Math.pow(2, attempt) * 1000
        console.log(`[fetch-page] HTTP ${res.status}, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`)
        await sleep(delay)
        continue
      }

      throw new Error(`HTTP ${res.status}: ${res.statusText}`)
    } catch (err) {
      const isTimeout = err.name === 'AbortError'
      const isNetworkError = err.message.includes('fetch') || isTimeout
      const shouldRetry = isNetworkError && attempt < maxRetries - 1

      if (shouldRetry) {
        const delay = Math.pow(2, attempt) * 1000
        console.log(`[fetch-page] Attempt ${attempt + 1}/${maxRetries} failed: ${err.message}, retrying in ${delay}ms`)
        await sleep(delay)
      } else {
        throw err
      }
    }
  }

  throw new Error(`Failed to fetch ${url} after ${maxRetries} attempts`)
}
