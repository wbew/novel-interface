import { chromium } from 'playwright'
import { GoogleGenerativeAI } from '@google/generative-ai'
import type { ContentItem } from '../shapes/content-block/types'

export type ExtractedContent = {
  pageTitle: string
  summary: string
  items: ContentItem[]
  error?: string
}

export async function extractContent(targetUrl: string): Promise<ExtractedContent> {
  const browser = await chromium.launch({ headless: true })

  try {
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1440, height: 900 },
    })
    const page = await context.newPage()

    await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 30000 })

    // Wait for content to load
    await page.waitForTimeout(2000)

    // Scroll to load more content
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

    await page.waitForTimeout(1000)

    const pageTitle = await page.title()

    // Extract structured content from the page
    const extracted = await page.evaluate(() => {
      const items: Array<{
        type: 'link' | 'heading' | 'image' | 'video' | 'text'
        title: string
        description?: string
        url?: string
        thumbnail?: string
        metadata?: Record<string, string>
      }> = []

      // Extract headings (structure of the page)
      const headings = document.querySelectorAll('h1, h2, h3')
      headings.forEach((h) => {
        const text = h.textContent?.trim()
        if (text && text.length > 2 && text.length < 200) {
          items.push({
            type: 'heading',
            title: text,
            metadata: { level: h.tagName.toLowerCase() },
          })
        }
      })

      // Extract links with meaningful text
      const links = document.querySelectorAll('a[href]')
      const seenUrls = new Set<string>()
      links.forEach((a) => {
        const href = a.getAttribute('href')
        const text = a.textContent?.trim()
        if (
          href &&
          text &&
          text.length > 3 &&
          text.length < 150 &&
          !href.startsWith('#') &&
          !href.startsWith('javascript:') &&
          !seenUrls.has(href)
        ) {
          seenUrls.add(href)
          const fullUrl = href.startsWith('http')
            ? href
            : href.startsWith('/')
              ? `${window.location.origin}${href}`
              : `${window.location.origin}/${href}`

          items.push({
            type: 'link',
            title: text,
            url: fullUrl,
          })
        }
      })

      // Extract images with alt text or in figures
      const images = document.querySelectorAll('img[src], figure img')
      const seenImages = new Set<string>()
      images.forEach((img) => {
        const src = img.getAttribute('src')
        const alt = img.getAttribute('alt')
        const figcaption = img.closest('figure')?.querySelector('figcaption')?.textContent?.trim()

        if (src && !seenImages.has(src) && (alt || figcaption)) {
          seenImages.add(src)
          const fullSrc = src.startsWith('http')
            ? src
            : src.startsWith('//')
              ? `https:${src}`
              : src.startsWith('/')
                ? `${window.location.origin}${src}`
                : src

          // Skip tiny images (likely icons) and data URLs
          if (!src.startsWith('data:') && !src.includes('icon') && !src.includes('logo')) {
            items.push({
              type: 'image',
              title: alt || figcaption || 'Image',
              description: figcaption || undefined,
              thumbnail: fullSrc,
            })
          }
        }
      })

      // Extract video elements
      const videos = document.querySelectorAll('video, iframe[src*="youtube"], iframe[src*="vimeo"]')
      videos.forEach((v) => {
        if (v.tagName === 'IFRAME') {
          const src = v.getAttribute('src') || ''
          const title = v.getAttribute('title') || 'Embedded video'
          items.push({
            type: 'video',
            title,
            url: src,
          })
        } else {
          const poster = (v as HTMLVideoElement).poster
          const src = (v as HTMLVideoElement).src || v.querySelector('source')?.src
          items.push({
            type: 'video',
            title: 'Video',
            url: src || undefined,
            thumbnail: poster || undefined,
          })
        }
      })

      // Get raw text content for summarization
      const mainSelectors = ['main', 'article', '[role="main"]', '.content', '#content']
      let mainEl: Element | null = null
      for (const sel of mainSelectors) {
        mainEl = document.querySelector(sel)
        if (mainEl) break
      }
      mainEl = mainEl || document.body

      const rawContent = (mainEl as HTMLElement).innerText.slice(0, 8000)

      return {
        items: items.slice(0, 50), // Limit to 50 items
        rawContent,
      }
    })

    // Generate summary using Gemini
    let summary = ''
    const apiKey = process.env.GEMINI_API_KEY
    if (apiKey && extracted.rawContent.length > 0) {
      try {
        summary = await summarizeWithGemini(apiKey, extracted.rawContent, pageTitle, targetUrl)
      } catch (error) {
        console.error('Gemini summarization failed:', error)
        summary = `Extracted ${extracted.items.length} items from page. Content preview: ${extracted.rawContent.slice(0, 200)}...`
      }
    } else if (!apiKey) {
      summary = `GEMINI_API_KEY not set. Extracted ${extracted.items.length} items from page.`
    }

    return {
      pageTitle,
      summary,
      items: extracted.items,
    }
  } catch (error) {
    return {
      pageTitle: '',
      summary: '',
      items: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  } finally {
    await browser.close()
  }
}

async function summarizeWithGemini(
  apiKey: string,
  content: string,
  pageTitle: string,
  url: string
): Promise<string> {
  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

  const prompt = `Analyze this webpage and provide a concise summary (3-5 sentences). Focus on:
1. What is this page about?
2. What type of content does it contain?
3. Who is the target audience?
4. What are the key takeaways or main topics?

URL: ${url}
Page title: ${pageTitle}

Page content:
${content.slice(0, 5000)}

Provide a clear, informative summary:`

  const result = await model.generateContent(prompt)
  const response = await result.response
  return response.text()
}
