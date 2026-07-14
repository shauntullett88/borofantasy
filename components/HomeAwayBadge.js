export default function HomeAwayBadge({ home }) {
  return (
    <span
      className={`text-xs font-bold px-1.5 py-0.5 rounded shrink-0 ${
        home ? 'bg-green-800 text-green-300' : 'bg-red-900 text-red-300'
      }`}
    >
      {home ? 'H' : 'A'}
    </span>
  )
}
