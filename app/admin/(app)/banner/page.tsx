import { getHomeBanner } from '@/lib/server/home-banner'
import BannerEditor from './banner-editor'

export const dynamic = 'force-dynamic'

// Super admins choose the banner at the top of the buyer home screen.
export default async function BannerPage() {
  const banner = await getHomeBanner()
  return <BannerEditor initial={banner} />
}
