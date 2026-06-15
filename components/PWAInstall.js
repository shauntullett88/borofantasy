'use client'
import { useEffect, useState } from 'react'

export default function PWAInstall() {
  const [prompt, setPrompt] = useState(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault()
      setPrompt(e)
      setVisible(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const install = async () => {
    if (!prompt) return
    await prompt.prompt()
    setVisible(false)
    setPrompt(null)
  }

  if (!visible) return null

  return (
    <div className="fixed top-16 left-4 right-4 bg-ffc-surface border border-ffc-gold rounded-xl p-4 flex items-center gap-3 z-50 shadow-lg">
      <div className="text-2xl">📱</div>
      <div className="flex-1">
        <p className="font-semibold text-sm">Install FFL App</p>
        <p className="text-xs text-gray-400">Add to your home screen</p>
      </div>
      <div className="flex gap-2">
        <button onClick={() => setVisible(false)} className="text-xs text-gray-400 px-3 py-1">
          Later
        </button>
        <button
          onClick={install}
          className="bg-ffc-gold text-black text-xs font-bold px-3 py-1 rounded-lg"
        >
          Install
        </button>
      </div>
    </div>
  )
}
