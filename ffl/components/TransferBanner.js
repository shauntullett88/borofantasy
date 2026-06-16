'use client'
import { getTransferWindowStatus, nextTransferWindow } from '../lib/game'

function formatUK(date) {
  return date.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'long',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Europe/London',
  })
}

export default function TransferBanner() {
  const status = getTransferWindowStatus()

  if (status.open) {
    return (
      <div className="text-center text-sm font-semibold py-2 px-4 bg-ffc-gold text-black">
        🟢 Transfer Window OPEN — closes {formatUK(status.closesAt)} (UK time)
      </div>
    )
  }

  const next = nextTransferWindow()
  return (
    <div className="text-center text-sm font-semibold py-2 px-4 bg-ffc-red text-white">
      🔴 Transfer Window CLOSED — opens {formatUK(next.opensAt)} (UK time)
    </div>
  )
}
