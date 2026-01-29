import { chromium } from 'playwright'
import type { DiscoveredEndpoint } from '../shapes/api-block/types'

export async function discoverApis(targetUrl: string): Promise<{
  endpoints: DiscoveredEndpoint[]
  pageTitle: string
  error?: string
}> {
  const browser = await chromium.launch({ headless: true })
  const endpoints: DiscoveredEndpoint[] = []
  const seenUrls = new Set<string>()

  try {
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1440, height: 900 },
    })
    const page = await context.newPage()

    page.on('response', async (response) => {
      try {
        const request = response.request()
        const url = request.url()
        const contentType = response.headers()['content-type'] || ''

        // Skip if we've already seen this URL
        if (seenUrls.has(url)) return
        seenUrls.add(url)

        // Filter for API-like responses
        const isJson = contentType.includes('application/json')
        const isApiUrl =
          url.includes('/api/') ||
          url.includes('/v1/') ||
          url.includes('/v2/') ||
          url.includes('/v3/') ||
          url.includes('youtubei/') ||
          url.includes('innertube/') ||
          url.includes('browse') ||
          url.includes('search') ||
          url.includes('player') ||
          url.includes('next') ||
          url.includes('guide')

        // Skip static assets and tracking
        const isStaticOrTracking =
          url.includes('.js') ||
          url.includes('.css') ||
          url.includes('.png') ||
          url.includes('.jpg') ||
          url.includes('.svg') ||
          url.includes('.woff') ||
          url.includes('analytics') ||
          url.includes('tracking') ||
          url.includes('telemetry') ||
          url.includes('log_event') ||
          url.includes('generate_204') ||
          url.includes('googlevideo.com') ||
          url.includes('googleadservices') ||
          url.includes('doubleclick')

        if (!isJson && !isApiUrl) return
        if (isStaticOrTracking) return

        // Get response body preview
        let responsePreview = ''
        try {
          const body = await response.text()
          if (body.length > 0) {
            // Try to parse and pretty print
            try {
              const parsed = JSON.parse(body)
              const preview = JSON.stringify(parsed, null, 2)
              responsePreview = preview.slice(0, 200) + (preview.length > 200 ? '...' : '')
            } catch {
              responsePreview = body.slice(0, 200) + (body.length > 200 ? '...' : '')
            }
          }
        } catch {
          // Response body might not be available
        }

        // Get request body if present
        let requestBody = ''
        if (request.method() !== 'GET') {
          try {
            const postData = request.postData()
            if (postData) {
              requestBody = postData.slice(0, 500)
            }
          } catch {
            // Request body might not be available
          }
        }

        endpoints.push({
          url,
          method: request.method(),
          status: response.status(),
          contentType: contentType.split(';')[0],
          requestBody: requestBody || undefined,
          responsePreview: responsePreview || undefined,
        })
      } catch {
        // Ignore errors from response handling
      }
    })

    await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 30000 })

    // Wait a bit for initial API calls
    await page.waitForTimeout(2000)

    // Scroll to trigger lazy loading (especially important for YouTube)
    await page.evaluate(() => {
      return new Promise<void>((resolve) => {
        let totalHeight = 0
        const distance = 500
        const timer = setInterval(() => {
          const scrollHeight = document.documentElement.scrollHeight
          window.scrollBy(0, distance)
          totalHeight += distance

          if (totalHeight >= scrollHeight || totalHeight > 3000) {
            clearInterval(timer)
            resolve()
          }
        }, 200)
      })
    })

    // Wait for more API calls after scrolling
    await page.waitForTimeout(3000)

    const pageTitle = await page.title()

    // Sort endpoints by relevance (prioritize non-GET methods and youtube-specific endpoints)
    endpoints.sort((a, b) => {
      const aScore = getEndpointScore(a)
      const bScore = getEndpointScore(b)
      return bScore - aScore
    })

    return { endpoints: endpoints.slice(0, 20), pageTitle }
  } catch (error) {
    return {
      endpoints: [],
      pageTitle: '',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  } finally {
    await browser.close()
  }
}

function getEndpointScore(endpoint: DiscoveredEndpoint): number {
  let score = 0

  // Prioritize non-GET methods (usually more interesting APIs)
  if (endpoint.method !== 'GET') score += 10

  // Prioritize YouTube-specific endpoints
  if (endpoint.url.includes('youtubei')) score += 20
  if (endpoint.url.includes('browse')) score += 15
  if (endpoint.url.includes('search')) score += 15
  if (endpoint.url.includes('player')) score += 15
  if (endpoint.url.includes('next')) score += 10
  if (endpoint.url.includes('guide')) score += 10

  // Prioritize successful responses
  if (endpoint.status >= 200 && endpoint.status < 300) score += 5

  // Prioritize JSON responses
  if (endpoint.contentType.includes('json')) score += 5

  return score
}
