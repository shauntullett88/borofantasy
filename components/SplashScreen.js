'use client'
import { useEffect, useState } from 'react'

// Branded splash shown once each time the app is opened.
// The Farnborough badge zooms in (with a little overshoot), holds,
// then zooms out and fades away. Mounted in the root layout, so it
// does NOT replay on internal page navigation — only on a fresh open.
export default function SplashScreen() {
  const [hiding, setHiding] = useState(false)
  const [gone, setGone] = useState(false)

  useEffect(() => {
    // Badge zoom animation runs for ~2s, then we fade the overlay out.
    const hideTimer = setTimeout(() => setHiding(true), 2000)
    // Remove from the DOM once the fade-out has finished (2000 + 450ms).
    const goneTimer = setTimeout(() => setGone(true), 2500)
    return () => {
      clearTimeout(hideTimer)
      clearTimeout(goneTimer)
    }
  }, [])

  if (gone) return null

  return (
    <div className={`splash-screen${hiding ? ' is-hiding' : ''}`} aria-hidden="true">
      <div className="splash-glow" />
      {/* Plain <img> keeps the transform crisp and avoids next/image layout quirks at large sizes */}
      <img className="splash-badge" src="/badge.png" alt="Farnborough Football Club" />
    </div>
  )
}
