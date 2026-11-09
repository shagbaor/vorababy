import { redirect } from 'next/navigation'
import { getAdminSession } from '@/lib/admin/session'
import { FirebaseClientProvider } from '@/lib/firebase/client'

export const dynamic = 'force-dynamic'

export default async function AdminAuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  if (await getAdminSession()) redirect('/admin')

  const projectId = process.env.FIREBASE_PROJECT_ID ?? ''
  const config = { apiKey: process.env.FIREBASE_WEB_API_KEY ?? '', authDomain: `${projectId}.firebaseapp.com`, projectId }

  return (
    <FirebaseClientProvider config={config}>
      <div className="mx-auto min-h-dvh w-full max-w-[390px] bg-[#fefdfd] px-6 pb-10">{children}</div>
    </FirebaseClientProvider>
  )
}
