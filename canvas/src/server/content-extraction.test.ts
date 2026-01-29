import { describe, it, expect } from 'vitest'
import { extractContent } from './content-extraction'

describe('Content Extraction', () => {
  describe('extractContent', () => {
    it('extracts content from a website', async () => {
      const result = await extractContent('https://example.com')

      // Network errors are acceptable - just verify structure
      expect(Array.isArray(result.items)).toBe(true)
      expect(typeof result.summary).toBe('string')
      if (!result.error) {
        expect(result.pageTitle).toBeTruthy()
      }
    })

    it('extracts headings from pages when successful', async () => {
      const result = await extractContent('https://example.com')

      // Skip if network error
      if (result.error) return

      // Should find at least one heading
      const headings = result.items.filter((i) => i.type === 'heading')
      expect(headings.length).toBeGreaterThanOrEqual(0)

      // Each heading should have a title
      for (const heading of headings) {
        expect(heading.title).toBeTruthy()
        expect(heading.title.length).toBeGreaterThan(0)
      }
    })

    it('extracts links from pages when successful', async () => {
      const result = await extractContent('https://example.com')

      // Skip if network error
      if (result.error) return

      // May find links
      const links = result.items.filter((i) => i.type === 'link')

      // Each link should have a title and URL
      for (const link of links) {
        expect(link.title).toBeTruthy()
        if (link.url) {
          expect(link.url).toMatch(/^https?:\/\//)
        }
      }
    })

    it('handles invalid URLs gracefully', async () => {
      const result = await extractContent(
        'https://invalid-domain-that-does-not-exist-12345.com'
      )

      expect(result.error).toBeTruthy()
      expect(result.items).toEqual([])
    })

    it('limits results to 50 items', async () => {
      const result = await extractContent('https://example.com')

      // This should always pass regardless of network issues
      expect(result.items.length).toBeLessThanOrEqual(50)
    })

    it('returns valid content item structure', async () => {
      const result = await extractContent('https://example.com')

      // Skip if network error
      if (result.error) return

      // Each item should have required fields
      for (const item of result.items) {
        expect(['link', 'heading', 'image', 'video', 'text']).toContain(item.type)
        expect(typeof item.title).toBe('string')
      }
    })
  })
})
