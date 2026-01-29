import type { TLBaseShape } from 'tldraw'

export type DiscoveredEndpoint = {
  url: string
  method: string
  status: number
  contentType: string
  requestBody?: string
  responsePreview?: string
}

export type ApiBlockShape = TLBaseShape<
  'api-block',
  {
    parentUrl: string
    endpoints: DiscoveredEndpoint[]
    w: number
    h: number
  }
>

export const API_BLOCK_TYPE = 'api-block' as const
