import { ShapeUtil, HTMLContainer, Rectangle2d, T, TLOnResizeHandler, resizeBox } from 'tldraw'
import type { ContentBlockShape, ContentItem } from './types'
import { CONTENT_BLOCK_TYPE } from './types'

function ContentItemDisplay({ item }: { item: ContentItem }) {
  const typeColors: Record<string, string> = {
    heading: '#6366f1',
    link: '#0066cc',
    image: '#059669',
    video: '#dc2626',
    text: '#6b7280',
  }

  const typeIcons: Record<string, string> = {
    heading: 'H',
    link: '→',
    image: '⎔',
    video: '▶',
    text: '¶',
  }

  return (
    <div
      style={{
        display: 'flex',
        gap: '8px',
        padding: '6px 8px',
        marginBottom: '4px',
        background: '#f8f9fa',
        borderRadius: '4px',
        border: '1px solid #e9ecef',
        alignItems: 'flex-start',
      }}
    >
      <span
        style={{
          width: '18px',
          height: '18px',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: typeColors[item.type] || '#6b7280',
          color: 'white',
          borderRadius: '3px',
          fontSize: '10px',
          fontWeight: 600,
        }}
      >
        {typeIcons[item.type] || '•'}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: '11px',
            fontWeight: item.type === 'heading' ? 600 : 400,
            color: '#1a1a1a',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {item.title}
        </div>
        {item.description && (
          <div
            style={{
              fontSize: '10px',
              color: '#666',
              marginTop: '2px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {item.description}
          </div>
        )}
        {item.url && item.type === 'link' && (
          <div
            style={{
              fontSize: '9px',
              color: '#0066cc',
              marginTop: '2px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {item.url}
          </div>
        )}
      </div>
      {item.thumbnail && (
        <div
          style={{
            width: '40px',
            height: '30px',
            flexShrink: 0,
            background: '#ddd',
            borderRadius: '3px',
            overflow: 'hidden',
          }}
        >
          <img
            src={item.thumbnail}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={(e) => (e.currentTarget.style.display = 'none')}
          />
        </div>
      )}
    </div>
  )
}

function ContentBlockComponent({ shape }: { shape: ContentBlockShape }) {
  const { parentUrl, pageTitle, summary, items } = shape.props

  // Group items by type
  const headings = items.filter((i) => i.type === 'heading')
  const links = items.filter((i) => i.type === 'link')
  const media = items.filter((i) => i.type === 'image' || i.type === 'video')

  const totalItems = items.length

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: 'white',
        borderRadius: '8px',
        border: '2px solid #5a9a5a',
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
          background: '#5a9a5a',
          color: 'white',
          fontWeight: 600,
          fontSize: '13px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <span style={{ fontSize: '16px' }}>Content</span>
        <span style={{ fontSize: '11px', opacity: 0.9 }}>
          {totalItems} item{totalItems !== 1 ? 's' : ''} extracted
        </span>
      </div>

      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '8px',
        }}
      >
        {pageTitle && (
          <div
            style={{
              fontWeight: 600,
              fontSize: '13px',
              color: '#1a1a1a',
              marginBottom: '8px',
              padding: '8px',
              background: '#f0f7f0',
              borderRadius: '4px',
            }}
          >
            {pageTitle}
          </div>
        )}

        {summary && (
          <div
            style={{
              fontSize: '11px',
              color: '#444',
              marginBottom: '12px',
              padding: '8px',
              background: '#f8f9fa',
              borderRadius: '4px',
              lineHeight: '1.5',
              whiteSpace: 'pre-wrap',
            }}
          >
            {summary}
          </div>
        )}

        {headings.length > 0 && (
          <div style={{ marginBottom: '12px' }}>
            <div
              style={{
                fontSize: '10px',
                fontWeight: 600,
                color: '#6366f1',
                marginBottom: '6px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              Page Structure ({headings.length})
            </div>
            {headings.slice(0, 8).map((item, i) => (
              <ContentItemDisplay key={`h-${i}`} item={item} />
            ))}
          </div>
        )}

        {links.length > 0 && (
          <div style={{ marginBottom: '12px' }}>
            <div
              style={{
                fontSize: '10px',
                fontWeight: 600,
                color: '#0066cc',
                marginBottom: '6px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              Links ({links.length})
            </div>
            {links.slice(0, 10).map((item, i) => (
              <ContentItemDisplay key={`l-${i}`} item={item} />
            ))}
            {links.length > 10 && (
              <div style={{ fontSize: '10px', color: '#888', padding: '4px 8px' }}>
                +{links.length - 10} more links
              </div>
            )}
          </div>
        )}

        {media.length > 0 && (
          <div style={{ marginBottom: '12px' }}>
            <div
              style={{
                fontSize: '10px',
                fontWeight: 600,
                color: '#059669',
                marginBottom: '6px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              Media ({media.length})
            </div>
            {media.slice(0, 6).map((item, i) => (
              <ContentItemDisplay key={`m-${i}`} item={item} />
            ))}
          </div>
        )}

        {totalItems === 0 && !summary && (
          <div
            style={{
              padding: '20px',
              textAlign: 'center',
              color: '#888',
              fontSize: '12px',
            }}
          >
            No content extracted
          </div>
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

export class ContentBlockShapeUtil extends ShapeUtil<ContentBlockShape> {
  static override type = CONTENT_BLOCK_TYPE

  static override props = {
    parentUrl: T.string,
    pageTitle: T.string,
    summary: T.string,
    items: T.arrayOf(
      T.object({
        type: T.string,
        title: T.string,
        description: T.optional(T.string),
        url: T.optional(T.string),
        thumbnail: T.optional(T.string),
        metadata: T.optional(T.dict(T.string, T.string)),
      })
    ),
    // Keep videos for backward compatibility
    videos: T.optional(
      T.arrayOf(
        T.object({
          title: T.string,
          channel: T.string,
          views: T.string,
          duration: T.string,
          thumbnail: T.string,
          url: T.string,
        })
      )
    ),
    w: T.number,
    h: T.number,
  }

  getDefaultProps(): ContentBlockShape['props'] {
    return {
      parentUrl: '',
      pageTitle: '',
      summary: '',
      items: [],
      w: 400,
      h: 350,
    }
  }

  getGeometry(shape: ContentBlockShape) {
    return new Rectangle2d({
      width: shape.props.w,
      height: shape.props.h,
      isFilled: true,
    })
  }

  component(shape: ContentBlockShape) {
    return (
      <HTMLContainer>
        <ContentBlockComponent shape={shape} />
      </HTMLContainer>
    )
  }

  indicator(shape: ContentBlockShape) {
    return <rect width={shape.props.w} height={shape.props.h} />
  }

  override canResize() {
    return true
  }

  override onResize: TLOnResizeHandler<ContentBlockShape> = (shape, info) => {
    return resizeBox(shape, info)
  }
}
