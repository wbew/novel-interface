import { ShapeUtil, HTMLContainer, Rectangle2d, T, TLOnResizeHandler, resizeBox } from 'tldraw'
import type { ApiBlockShape, DiscoveredEndpoint } from './types'
import { API_BLOCK_TYPE } from './types'

function ApiBlockComponent({ shape }: { shape: ApiBlockShape }) {
  const { parentUrl, endpoints } = shape.props

  const methodColors: Record<string, string> = {
    GET: '#61affe',
    POST: '#49cc90',
    PUT: '#fca130',
    DELETE: '#f93e3e',
    PATCH: '#50e3c2',
  }

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: 'white',
        borderRadius: '8px',
        border: '2px solid #61affe',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <div
        style={{
          padding: '10px 12px',
          background: '#61affe',
          color: 'white',
          fontWeight: 600,
          fontSize: '13px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <span style={{ fontSize: '16px' }}>API</span>
        <span style={{ fontSize: '11px', opacity: 0.9 }}>
          {endpoints.length} endpoint{endpoints.length !== 1 ? 's' : ''} discovered
        </span>
      </div>

      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '8px',
        }}
      >
        {endpoints.length === 0 ? (
          <div
            style={{
              padding: '20px',
              textAlign: 'center',
              color: '#888',
              fontSize: '12px',
            }}
          >
            No API endpoints discovered
          </div>
        ) : (
          endpoints.map((endpoint, i) => (
            <div
              key={i}
              style={{
                padding: '8px',
                marginBottom: '6px',
                background: '#f8f9fa',
                borderRadius: '4px',
                border: '1px solid #e9ecef',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span
                  style={{
                    background: methodColors[endpoint.method] || '#888',
                    color: 'white',
                    padding: '2px 6px',
                    borderRadius: '3px',
                    fontSize: '10px',
                    fontWeight: 700,
                    fontFamily: 'monospace',
                  }}
                >
                  {endpoint.method}
                </span>
                <span
                  style={{
                    fontSize: '10px',
                    color: endpoint.status >= 200 && endpoint.status < 300 ? '#28a745' : '#dc3545',
                    fontWeight: 500,
                  }}
                >
                  {endpoint.status}
                </span>
              </div>
              <div
                style={{
                  fontSize: '11px',
                  color: '#333',
                  fontFamily: 'monospace',
                  wordBreak: 'break-all',
                  lineHeight: '1.3',
                }}
              >
                {endpoint.url.length > 100 ? endpoint.url.slice(0, 100) + '...' : endpoint.url}
              </div>
              {endpoint.responsePreview && (
                <div
                  style={{
                    fontSize: '10px',
                    color: '#666',
                    marginTop: '4px',
                    fontFamily: 'monospace',
                    background: '#fff',
                    padding: '4px',
                    borderRadius: '2px',
                    maxHeight: '40px',
                    overflow: 'hidden',
                  }}
                >
                  {endpoint.responsePreview}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <div
        style={{
          padding: '6px 12px',
          borderTop: '1px solid #e0e0e0',
          background: '#f9f9f9',
          fontSize: '10px',
          color: '#666',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        Source: {parentUrl}
      </div>
    </div>
  )
}

export class ApiBlockShapeUtil extends ShapeUtil<ApiBlockShape> {
  static override type = API_BLOCK_TYPE

  static override props = {
    parentUrl: T.string,
    endpoints: T.arrayOf(
      T.object({
        url: T.string,
        method: T.string,
        status: T.number,
        contentType: T.string,
        requestBody: T.string.optional(),
        responsePreview: T.string.optional(),
      })
    ),
    w: T.number,
    h: T.number,
  }

  getDefaultProps(): ApiBlockShape['props'] {
    return {
      parentUrl: '',
      endpoints: [],
      w: 400,
      h: 200,
    }
  }

  getGeometry(shape: ApiBlockShape) {
    return new Rectangle2d({
      width: shape.props.w,
      height: shape.props.h,
      isFilled: true,
    })
  }

  component(shape: ApiBlockShape) {
    return (
      <HTMLContainer>
        <ApiBlockComponent shape={shape} />
      </HTMLContainer>
    )
  }

  indicator(shape: ApiBlockShape) {
    return <rect width={shape.props.w} height={shape.props.h} />
  }

  override canResize() {
    return true
  }

  override onResize: TLOnResizeHandler<ApiBlockShape> = (shape, info) => {
    return resizeBox(shape, info)
  }
}
