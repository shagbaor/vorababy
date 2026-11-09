import { redirect } from 'next/navigation'
import { getAdminSession } from '@/lib/admin/session'

export const dynamic = 'force-dynamic'

export default async function AdminAuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  if (await getAdminSession()) redirect('/admin')
  return <div className="mx-auto min-h-dvh w-full max-w-[390px] bg-[#fefdfd] px-6 pb-10">{children}</div>
}
