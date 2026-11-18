import { getHomeBanner } from '@/lib/server/home-banner'
import { getPromoSlides } from '@/lib/server/promo-slides'
import BannerEditor from './banner-editor'
import SlidesEditor from './slides-editor'

export const dynamic = 'force-dynamic'

// Super admins choose the promo slides and the banner on the buyer home screen.
export default async function BannerPage() {
  const [banner, slides] = await Promise.all([getHomeBanner(), getPromoSlides()])
  return (
    <>
      <BannerEditor initial={banner} />
      <div className="px-4">
        <SlidesEditor initial={slides} />
      </div>
    </>
  )
}
