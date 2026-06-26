import './globals.css'
import { AuthProvider } from '../components/AuthContext'
import BottomNav from '../components/BottomNav'
import TopHeader from '../components/TopHeader'
import TransferBanner from '../components/TransferBanner'
import PWAInstall from '../components/PWAInstall'
import SplashScreen from '../components/SplashScreen'

export const metadata = {
  title: 'Farnborough Fantasy League',
  description: 'Private fantasy football for Farnborough FC 2026/2027',
  manifest: '/manifest.json',
  themeColor: '#C8102E',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'FFL',
  },
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="FFL" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className="bg-ffc-dark text-white">
        <SplashScreen />
        <AuthProvider>
          <TopHeader />
          <TransferBanner />
          <main className="pb-20 min-h-screen">
            {children}
          </main>
          <BottomNav />
          <PWAInstall />
        </AuthProvider>
        <script dangerouslySetInnerHTML={{
          __html: `
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', () => {
                navigator.serviceWorker.register('/sw.js').catch(console.error)
              })
            }
          `
        }} />
      </body>
    </html>
  )
}
