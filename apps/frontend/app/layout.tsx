import type { Metadata, Viewport } from 'next'
import './globals.css'
import { ToastProvider } from '../components/Toast';
import DevSupportWidget from '../components/DevSupportWidget';
import PushInitializer from '../components/PushInitializer';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#6366f1',
}

export const metadata: Metadata = {
  title: 'ChronusDev - Tracking de Proyectos',
  description: 'Sistema de seguimiento de tiempo y presupuesto para proyectos de tecnología',
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.png',
    apple: '/favicon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'ChronusDev',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <ToastProvider>
          <PushInitializer />
          {children}
          <DevSupportWidget />
        </ToastProvider>
      </body>
    </html>
  )
}
