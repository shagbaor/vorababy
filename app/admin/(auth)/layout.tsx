export default function AdminAuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return <div className="mx-auto min-h-dvh w-full max-w-[390px] bg-[#fefdfd] px-6 pb-10">{children}</div>
}
