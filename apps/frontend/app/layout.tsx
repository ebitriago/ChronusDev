import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'ChronusDev - Tracking de Proyectos',
  description: 'Sistema de seguimiento de tiempo y presupuesto para proyectos de tecnología',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
