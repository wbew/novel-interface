import { createServerFn } from '@tanstack/react-start'
import type { DiscoveredEndpoint } from '../shapes/api-block/types'
import type { ContentItem } from '../shapes/content-block/types'

export const expandToApi = createServerFn({ method: 'POST' })
  .handler(async ({ data }): Promise<{
    endpoints: DiscoveredEndpoint[]
    pageTitle: string
    error?: string
  }> => {
    const url = data as string
    const { discoverApis } = await import('./api-discovery')
    return discoverApis(url)
  })

export const expandToContent = createServerFn({ method: 'POST' })
  .handler(async ({ data }): Promise<{
    pageTitle: string
    summary: string
    items: ContentItem[]
    error?: string
  }> => {
    const url = data as string
    const { extractContent } = await import('./content-extraction')
    return extractContent(url)
  })
