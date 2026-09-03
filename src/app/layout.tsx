import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'ABDCM — Plataforma de Ação Coletiva',
  description: 'Gestão de ação coletiva da Associação Brasileira de Defesa do Consumidor e do Mercado',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  )
}
