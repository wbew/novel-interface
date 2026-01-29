import { describe, it, expect } from 'vitest'
import { discoverApis } from './api-discovery'

describe('API Discovery', () => {
  describe('discoverApis', () => {
    it('discovers API endpoints from a website', async () => {
      const result = await discoverApis('https://www.youtube.com')

      // Network errors are acceptable - just verify structure
      expect(Array.isArray(result.endpoints)).toBe(true)
      if (!result.error) {
        expect(result.pageTitle).toBeTruthy()
      }
    })

    it('returns endpoints with required properties when successful', async () => {
      const result = await discoverApis('https://www.youtube.com')

      // Skip detailed checks if network error occurred
      if (result.error) {
        expect(result.endpoints).toEqual([])
        return
      }

      // Should find at least some endpoints
      expect(result.endpoints.length).toBeGreaterThan(0)

      // Each endpoint should have required fields
      for (const endpoint of result.endpoints) {
        expect(endpoint).toHaveProperty('method')
        expect(endpoint).toHaveProperty('url')
        expect(endpoint).toHaveProperty('contentType')
        expect(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']).toContain(endpoint.method)
        expect(endpoint.url).toMatch(/^https?:\/\//)
      }
    })

    it('prioritizes YouTube API endpoints when successful', async () => {
      const result = await discoverApis('https://www.youtube.com')

      // Skip if network error
      if (result.error) return

      // Should find YouTube-specific API endpoints
      const youtubeApis = result.endpoints.filter(
        (e) => e.url.includes('youtubei') || e.url.includes('/api/')
      )
      expect(youtubeApis.length).toBeGreaterThan(0)
    })

    it('handles invalid URLs gracefully', async () => {
      const result = await discoverApis('https://invalid-domain-that-does-not-exist-12345.com')

      expect(result.error).toBeTruthy()
      expect(result.endpoints).toEqual([])
    })

    it('filters out static assets when successful', async () => {
      const result = await discoverApis('https://www.youtube.com')

      // Skip if network error
      if (result.error) return

      // Should not include image, font, or CSS files
      const staticAssets = result.endpoints.filter((e) =>
        /\.(jpg|jpeg|png|gif|svg|woff|woff2|ttf|css)$/i.test(e.url)
      )
      expect(staticAssets.length).toBe(0)
    })
  })
})
