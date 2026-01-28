import type { Metadata } from 'next'
import './globals.css'
import { ToastProvider } from '../components/Toast';
import VoiceWidget from '../components/VoiceWidget';

export const metadata: Metadata = {
  title: 'ChronusDev - Tracking de Proyectos',
  description: 'Sistema de seguimiento de tiempo y presupuesto para proyectos de tecnología',
  icons: {
    icon: '/favicon.png',
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
          {children}
          {/* Global Support Widget - will show if configured */}
          {/* <VoiceWidget agentId="bMDKk8fD42Jq79r4a1q5" />  Demo Agent ID for testing */}
        </ToastProvider>
      </body>
    </html>
  )
}
