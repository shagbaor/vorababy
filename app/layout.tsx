import { Analytics } from '@vercel/analytics/next'
import { Outfit } from 'next/font/google'
import type { Metadata, Viewport } from 'next'
import './globals.css'

const outfit = Outfit({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Vorapicks - One app for everything you need',
  description: 'Multi-source marketplace for fresh farm produce, restaurant meals, and goods from local vendors, delivered fast by our driver network.',
  generator: '',
  icons: {
    icon: [
      {
        url: '/vorapicks-logo.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/vorapicks-logo.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/vorapicks-logo.png',
        type: 'image/svg+xml',
      },
    ],
    apple: '/vorapicks-logo.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: 'white' },
    { media: '(prefers-color-scheme: dark)', color: 'black' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="bg-white" style={outfit.style}>
      <body className="antialiased bg-white">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
