import BottomNav from '@/components/admin/bottom-nav'

export default function AdminAppLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <>
      <div className="mx-auto w-full max-w-[390px] pb-[110px]">{children}</div>
      <BottomNav />
    </>
  )
}
