import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { Tldraw } from 'tldraw'
import 'tldraw/tldraw.css'

export const Route = createFileRoute('/')({
  component: Index,
})

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
      <Tldraw />
    </div>
  )
}
