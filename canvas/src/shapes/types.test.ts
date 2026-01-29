import { describe, it, expect } from 'vitest'
import type { UrlShape, UrlShapeStatus } from './url-shape/types'
import type { ApiBlockShape, DiscoveredEndpoint } from './api-block/types'
import type { ContentBlockShape, ContentItem, VideoItem } from './content-block/types'
import { createShapeId } from 'tldraw'

describe('Shape Types', () => {
  describe('UrlShape', () => {
    it('has correct structure', () => {
      const shape: UrlShape = {
        id: createShapeId(),
        type: 'url',
        x: 0,
        y: 0,
        rotation: 0,
        isLocked: false,
        opacity: 1,
        meta: {},
        typeName: 'shape',
        parentId: 'page:page' as any,
        index: 'a1' as any,
        props: {
          url: 'https://example.com',
          title: 'Example',
          description: 'A test site',
          favicon: '',
          w: 300,
          h: 120,
          status: 'idle',
          errorMessage: '',
        },
      }

      expect(shape.type).toBe('url')
      expect(shape.props.url).toBe('https://example.com')
      expect(shape.props.status).toBe('idle')
    })

    it('supports all status values', () => {
      const statuses: UrlShapeStatus[] = [
        'idle',
        'expanding-api',
        'expanding-content',
        'error',
      ]

      statuses.forEach((status) => {
        expect(['idle', 'expanding-api', 'expanding-content', 'error']).toContain(status)
      })
    })
  })

  describe('ApiBlockShape', () => {
    it('has correct structure', () => {
      const endpoint: DiscoveredEndpoint = {
        method: 'GET',
        url: 'https://api.example.com/data',
        status: 200,
        contentType: 'application/json',
        responsePreview: '{"data": []}',
      }

      const shape: ApiBlockShape = {
        id: createShapeId(),
        type: 'api-block',
        x: 0,
        y: 0,
        rotation: 0,
        isLocked: false,
        opacity: 1,
        meta: {},
        typeName: 'shape',
        parentId: 'page:page' as any,
        index: 'a1' as any,
        props: {
          parentUrl: 'https://example.com',
          endpoints: [endpoint],
          w: 350,
          h: 200,
        },
      }

      expect(shape.type).toBe('api-block')
      expect(shape.props.endpoints).toHaveLength(1)
      expect(shape.props.endpoints[0].method).toBe('GET')
    })

    it('supports all HTTP methods', () => {
      const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
      methods.forEach((method) => {
        const endpoint: DiscoveredEndpoint = {
          method: method,
          url: 'https://api.example.com',
          status: 200,
          contentType: 'application/json',
        }
        expect(endpoint.method).toBe(method)
      })
    })
  })

  describe('ContentBlockShape', () => {
    it('has correct structure with items', () => {
      const item: ContentItem = {
        type: 'heading',
        title: 'Main Heading',
        description: 'A description',
      }

      const shape: ContentBlockShape = {
        id: createShapeId(),
        type: 'content-block',
        x: 0,
        y: 0,
        rotation: 0,
        isLocked: false,
        opacity: 1,
        meta: {},
        typeName: 'shape',
        parentId: 'page:page' as any,
        index: 'a1' as any,
        props: {
          parentUrl: 'https://example.com',
          pageTitle: 'Example Page',
          summary: 'A page with content',
          items: [item],
          w: 350,
          h: 300,
        },
      }

      expect(shape.type).toBe('content-block')
      expect(shape.props.items).toHaveLength(1)
      expect(shape.props.items[0].title).toBe('Main Heading')
    })

    it('supports all content item types', () => {
      const types: ContentItem['type'][] = ['link', 'heading', 'image', 'video', 'text']

      types.forEach((type) => {
        const item: ContentItem = {
          type,
          title: `Test ${type}`,
        }
        expect(item.type).toBe(type)
      })
    })

    it('supports legacy videos field', () => {
      const video: VideoItem = {
        title: 'Test Video',
        channel: 'Test Channel',
        views: '1M views',
        duration: '10:00',
        thumbnail: 'https://example.com/thumb.jpg',
        url: 'https://youtube.com/watch?v=123',
      }

      const shape: ContentBlockShape = {
        id: createShapeId(),
        type: 'content-block',
        x: 0,
        y: 0,
        rotation: 0,
        isLocked: false,
        opacity: 1,
        meta: {},
        typeName: 'shape',
        parentId: 'page:page' as any,
        index: 'a1' as any,
        props: {
          parentUrl: 'https://youtube.com',
          pageTitle: 'YouTube',
          summary: 'A YouTube page with videos',
          items: [],
          videos: [video],
          w: 350,
          h: 300,
        },
      }

      expect(shape.type).toBe('content-block')
      expect(shape.props.videos).toHaveLength(1)
      expect(shape.props.videos![0].title).toBe('Test Video')
    })
  })
})
