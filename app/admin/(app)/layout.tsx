import BottomNav from '@/components/admin/bottom-nav'
import { AdminStoreProvider } from '@/components/admin/admin-store'
import { loadAdminData } from '@/lib/admin/data'
import { requireAdmin } from '@/lib/admin/session'

export const dynamic = 'force-dynamic'

export default async function AdminAppLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const session = await requireAdmin()
  const { dashboard, ...initialState } = await loadAdminData()

  return (
    <AdminStoreProvider initialState={initialState} profile={{ uid: session.uid, name: session.name, initials: session.initials, superAdmin: session.superAdmin }} dashboard={dashboard}>
      <div className="mx-auto w-full max-w-[390px] pb-[110px]">{children}</div>
      <BottomNav />
    </AdminStoreProvider>
  )
}
