import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { Tldraw, createShapeId, Editor } from 'tldraw'
import 'tldraw/tldraw.css'
import { UrlShapeUtil, ApiBlockShapeUtil, ContentBlockShapeUtil } from '../shapes'
import type { UrlShape } from '../shapes'

export const Route = createFileRoute('/')({
  component: Index,
})

const customShapeUtils = [UrlShapeUtil, ApiBlockShapeUtil, ContentBlockShapeUtil]

async function fetchUrlMetadata(url: string): Promise<{
  title: string
  description: string
  favicon: string
}> {
  try {
    // Try to extract domain for favicon
    const urlObj = new URL(url)
    const favicon = `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=32`

    // For now, use basic metadata - in production you'd fetch og:tags from the page
    return {
      title: urlObj.hostname,
      description: url,
      favicon,
    }
  } catch {
    return {
      title: 'URL',
      description: url,
      favicon: '',
    }
  }
}

function setupUrlHandler(editor: Editor) {
  editor.registerExternalContentHandler('url', async (content) => {
    const { point, url } = content
    const center = point ?? editor.getViewportPageBounds().center

    // Fetch metadata for the URL
    const metadata = await fetchUrlMetadata(url)

    // Create our custom URL shape
    const shapeId = createShapeId()
    editor.createShape<UrlShape>({
      id: shapeId,
      type: 'url',
      x: center.x - 150,
      y: center.y - 70,
      props: {
        url,
        title: metadata.title,
        description: metadata.description,
        favicon: metadata.favicon,
        w: 300,
        h: 140,
        status: 'idle',
        errorMessage: '',
      },
    })

    editor.select(shapeId)
  })
}

function Index() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return null
  }

  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <Tldraw
        shapeUtils={customShapeUtils}
        onMount={(editor) => {
          setupUrlHandler(editor)
        }}
      />
    </div>
  )
}
