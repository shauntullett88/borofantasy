'use client'
import { isTransferWindowOpen, nextTransferWindow } from '../lib/game'

export default function TransferBanner() {
  const open = isTransferWindowOpen()
  const next = nextTransferWindow()
  const fmt = next.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div className={`text-center text-sm font-semibold py-2 px-4 ${open ? 'bg-ffc-gold text-black' : 'bg-ffc-red text-white'}`}>
      {open
        ? '🟢 Transfer Window is OPEN — Make your changes now!'
        : `🔴 Transfer Window CLOSED — Next window: ${fmt}`}
    </div>
  )
}
