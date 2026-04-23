import type { Metadata } from 'next'
import { Fraunces, Geist_Mono, Public_Sans } from 'next/font/google'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from 'sonner'
import { ConvexProvider } from '@/components/providers/ConvexProvider'
import './globals.css'

const publicSans = Public_Sans({
  variable: '--font-public-sans',
  subsets: ['latin'],
})

const fraunces = Fraunces({
  variable: '--font-fraunces',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'PixelCraft - Generador de Imágenes y Videos con IA',
  description: 'Genera, edita y combina imágenes y videos con IA',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${publicSans.variable} ${fraunces.variable} ${geistMono.variable} antialiased`}
        dir="ltr"
      >
        <TooltipProvider>
          <ConvexProvider>
            {children}
          </ConvexProvider>
          <Toaster position="bottom-right" />
        </TooltipProvider>
      </body>
    </html>
  )
}
