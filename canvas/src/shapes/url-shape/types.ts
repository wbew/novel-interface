import type { TLBaseShape } from 'tldraw'

export type UrlShapeStatus = 'idle' | 'expanding-api' | 'expanding-content' | 'error'

export type UrlShape = TLBaseShape<
  'url',
  {
    url: string
    title: string
    description: string
    favicon: string
    w: number
    h: number
    status: UrlShapeStatus
    errorMessage: string
  }
>

export const URL_SHAPE_TYPE = 'url' as const
