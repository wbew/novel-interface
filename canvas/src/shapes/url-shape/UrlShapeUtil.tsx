import {
  ShapeUtil,
  HTMLContainer,
  Rectangle2d,
  T,
  TLOnResizeHandler,
  resizeBox,
  useEditor,
  createShapeId,
} from 'tldraw'
import type { UrlShape } from './types'
import { URL_SHAPE_TYPE } from './types'
import { expandToApi, expandToContent } from '../../server/expand-url'

function UrlShapeComponent({ shape }: { shape: UrlShape }) {
  const editor = useEditor()
  const { url, title, description, favicon, status, errorMessage } = shape.props

  const handleExpandApi = async (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()

    editor.updateShape<UrlShape>({
      id: shape.id,
      type: 'url',
      props: { status: 'expanding-api' },
    })

    try {
      const result = await expandToApi({ data: url })

      const apiBlockId = createShapeId()
      const arrowId = createShapeId()

      editor.createShapes([
        {
          id: apiBlockId,
          type: 'api-block',
          x: shape.x + shape.props.w + 80,
          y: shape.y,
          props: {
            parentUrl: url,
            endpoints: result.endpoints,
            w: 400,
            h: Math.max(200, result.endpoints.length * 60 + 60),
          },
        },
        {
          id: arrowId,
          type: 'arrow',
          props: {
            start: { x: shape.x + shape.props.w, y: shape.y + shape.props.h / 2 },
            end: { x: shape.x + shape.props.w + 80, y: shape.y + 100 },
          },
        },
      ])

      editor.updateShape<UrlShape>({
        id: shape.id,
        type: 'url',
        props: { status: 'idle' },
      })
    } catch (error) {
      editor.updateShape<UrlShape>({
        id: shape.id,
        type: 'url',
        props: {
          status: 'error',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        },
      })
    }
  }

  const handleExpandContent = async (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()

    editor.updateShape<UrlShape>({
      id: shape.id,
      type: 'url',
      props: { status: 'expanding-content' },
    })

    try {
      const result = await expandToContent({ data: url })

      const contentBlockId = createShapeId()
      const arrowId = createShapeId()

      editor.createShapes([
        {
          id: contentBlockId,
          type: 'content-block',
          x: shape.x + shape.props.w + 80,
          y: shape.y + 150,
          props: {
            parentUrl: url,
            pageTitle: result.pageTitle,
            summary: result.summary,
            items: result.items,
            w: 400,
            h: Math.max(350, result.items.length * 30 + 150),
          },
        },
        {
          id: arrowId,
          type: 'arrow',
          props: {
            start: { x: shape.x + shape.props.w, y: shape.y + shape.props.h / 2 },
            end: { x: shape.x + shape.props.w + 80, y: shape.y + 250 },
          },
        },
      ])

      editor.updateShape<UrlShape>({
        id: shape.id,
        type: 'url',
        props: { status: 'idle' },
      })
    } catch (error) {
      editor.updateShape<UrlShape>({
        id: shape.id,
        type: 'url',
        props: {
          status: 'error',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        },
      })
    }
  }

  const isLoading = status === 'expanding-api' || status === 'expanding-content'

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: 'white',
        borderRadius: '8px',
        border: '1px solid #e0e0e0',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <div style={{ padding: '12px', flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          {favicon && (
            <img
              src={favicon}
              alt=""
              style={{ width: '16px', height: '16px', borderRadius: '2px' }}
              onError={(e) => (e.currentTarget.style.display = 'none')}
            />
          )}
          <div
            style={{
              fontWeight: 600,
              fontSize: '14px',
              color: '#1a1a1a',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {title || 'Loading...'}
          </div>
        </div>
        {description && (
          <div
            style={{
              fontSize: '12px',
              color: '#666',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              lineHeight: '1.4',
            }}
          >
            {description}
          </div>
        )}
        <div
          style={{
            fontSize: '11px',
            color: '#0066cc',
            marginTop: '8px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {url}
        </div>
      </div>

      {status === 'error' && (
        <div
          style={{
            padding: '8px 12px',
            background: '#fee',
            color: '#c00',
            fontSize: '11px',
            borderTop: '1px solid #fcc',
          }}
        >
          {errorMessage}
        </div>
      )}

      <div
        style={{
          display: 'flex',
          gap: '8px',
          padding: '8px 12px',
          borderTop: '1px solid #e0e0e0',
          background: '#f9f9f9',
          pointerEvents: 'all',
        }}
      >
        <button
          onClick={handleExpandApi}
          onPointerDown={(e) => {
            e.stopPropagation()
          }}
          onPointerUp={(e) => {
            e.stopPropagation()
          }}
          disabled={isLoading}
          style={{
            flex: 1,
            padding: '6px 12px',
            background: status === 'expanding-api' ? '#ccc' : '#4a90d9',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '12px',
            fontWeight: 500,
            cursor: isLoading ? 'wait' : 'pointer',
            opacity: isLoading && status !== 'expanding-api' ? 0.6 : 1,
            pointerEvents: 'all',
          }}
        >
          {status === 'expanding-api' ? 'Discovering...' : 'API'}
        </button>
        <button
          onClick={handleExpandContent}
          onPointerDown={(e) => {
            e.stopPropagation()
          }}
          onPointerUp={(e) => {
            e.stopPropagation()
          }}
          disabled={isLoading}
          style={{
            flex: 1,
            padding: '6px 12px',
            background: status === 'expanding-content' ? '#ccc' : '#5a9a5a',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '12px',
            fontWeight: 500,
            cursor: isLoading ? 'wait' : 'pointer',
            opacity: isLoading && status !== 'expanding-content' ? 0.6 : 1,
            pointerEvents: 'all',
          }}
        >
          {status === 'expanding-content' ? 'Extracting...' : 'Content'}
        </button>
      </div>
    </div>
  )
}

export class UrlShapeUtil extends ShapeUtil<UrlShape> {
  static override type = URL_SHAPE_TYPE

  static override props = {
    url: T.string,
    title: T.string,
    description: T.string,
    favicon: T.string,
    w: T.number,
    h: T.number,
    status: T.string,
    errorMessage: T.string,
  }

  getDefaultProps(): UrlShape['props'] {
    return {
      url: '',
      title: '',
      description: '',
      favicon: '',
      w: 300,
      h: 140,
      status: 'idle',
      errorMessage: '',
    }
  }

  getGeometry(shape: UrlShape) {
    return new Rectangle2d({
      width: shape.props.w,
      height: shape.props.h,
      isFilled: true,
    })
  }

  component(shape: UrlShape) {
    return (
      <HTMLContainer>
        <div style={{ pointerEvents: 'all', width: '100%', height: '100%' }}>
          <UrlShapeComponent shape={shape} />
        </div>
      </HTMLContainer>
    )
  }

  indicator(shape: UrlShape) {
    return <rect width={shape.props.w} height={shape.props.h} />
  }

  override canResize() {
    return true
  }

  override onResize: TLOnResizeHandler<UrlShape> = (shape, info) => {
    return resizeBox(shape, info)
  }
}
