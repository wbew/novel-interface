import type { TLBaseShape } from 'tldraw'

// Generic content item that can represent any extracted content
export type ContentItem = {
  type: 'link' | 'heading' | 'image' | 'video' | 'text'
  title: string
  description?: string
  url?: string
  thumbnail?: string
  metadata?: Record<string, string>
}

// Keep VideoItem for backward compatibility with YouTube extraction
export type VideoItem = {
  title: string
  channel: string
  views: string
  duration: string
  thumbnail: string
  url: string
}

export type ContentBlockShape = TLBaseShape<
  'content-block',
  {
    parentUrl: string
    pageTitle: string
    summary: string
    items: ContentItem[]
    // Legacy field for YouTube videos - will be migrated to items
    videos?: VideoItem[]
    w: number
    h: number
  }
>

export const CONTENT_BLOCK_TYPE = 'content-block' as const
