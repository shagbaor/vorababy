import { Outfit } from 'next/font/google'
import type { Metadata } from 'next'
import { AdminStoreProvider } from '@/components/admin/admin-store'

const outfit = Outfit({ subsets: ['latin'] })

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
    <div className={`${outfit.className} min-h-dvh bg-white text-[#1e1e1e]`}>
      <AdminStoreProvider>{children}</AdminStoreProvider>
    </div>
  )
}
