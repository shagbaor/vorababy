import BottomNav from '@/components/admin/bottom-nav'
import SideNav from '@/components/admin/side-nav'
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
  const { dashboard, ...initialState } = await loadAdminData({ superAdmin: session.superAdmin })

  return (
    <AdminStoreProvider initialState={initialState} profile={{ uid: session.uid, name: session.name, initials: session.initials, superAdmin: session.superAdmin }} dashboard={dashboard}>
      <SideNav />
      {/* Phone: a single 390px column. Desktop: beside the sidebar, wider. */}
      <div className="lg:pl-[248px]">
        <div className="mx-auto w-full max-w-[390px] pb-[110px] lg:max-w-[1180px] lg:px-6 lg:pb-12">{children}</div>
      </div>
      <BottomNav />
    </AdminStoreProvider>
  )
}
