import type { Metadata } from 'next'
import './globals.css'

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
      <body suppressHydrationWarning>{children}</body>
    </html>
  )
}
