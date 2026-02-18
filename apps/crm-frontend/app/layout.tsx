import type { Metadata, Viewport } from 'next'
import './globals.css'
import { ToastProvider } from '../components/Toast';
import AuthProvider from '../components/AuthProvider';
import VoiceWidget from '../components/VoiceWidget';
import FloatingChatButton from '../components/FloatingChatButton';
import CapacitorInit from '../components/CapacitorInit';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#10b981',
}

export const metadata: Metadata = {
  title: 'ChronusCRM - CRM Inteligente',
  description: 'Sistema CRM inteligente para gestión de clientes, ventas y soporte',
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.png',
    apple: '/favicon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'ChronusCRM',
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
          <AuthProvider>
            {children}
            {/* Floating chat button for quick message access */}
            <FloatingChatButton />
            {/* Native Capacitor Initialization */}
            <CapacitorInit />
            {/* Global Support Widget - will show if configured */}
            {/* <VoiceWidget agentId="bMDKk8fD42Jq79r4a1q5" />  Demo Agent ID for testing */}
          </AuthProvider>
        </ToastProvider>
      </body>
    </html>
  )
}
