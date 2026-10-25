import { Inter } from 'next/font/google'
import type { Metadata } from 'next'
import BottomNav from '@/components/admin/bottom-nav'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Admin - Vorapicks',
  robots: { index: false, follow: false },
}

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <div className={`${inter.className} min-h-dvh bg-white text-[#1e1e1e]`}>
      <div className="mx-auto w-full max-w-[390px] pb-[96px]">{children}</div>
      <BottomNav />
    </div>
  )
}
