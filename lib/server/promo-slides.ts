import 'server-only'
import { db } from '@/lib/firebase/admin'

// The swipeable promo banner on the buyer home screen: 3 slides for each
// marketplace. Super admins replace them on /admin/banner. Stored in
// meta/content.promoSlides = { farm: Slide[], restaurants: Slide[] }.
export type Marketplace = 'farm' | 'restaurants'
export type PromoSlide = {
  imageUrl: string | null
  eyebrow: string // small line above the title, e.g. "Order from local restaurants"
  title: string // e.g. "Food Near You"
  buttonText: string // e.g. "Browse All"
  link: string | null // optional https:// link; otherwise the button opens the marketplace list
}

export const SLIDE_COUNT = 3

const EMPTY: PromoSlide = { imageUrl: null, eyebrow: '', title: '', buttonText: '', link: null }

export async function getPromoSlides(): Promise<Record<Marketplace, PromoSlide[]>> {
  const snapshot = await db().collection('meta').doc('content').get()
  const saved = (snapshot.get('promoSlides') ?? {}) as Partial<Record<Marketplace, Partial<PromoSlide>[]>>
  const fill = (list: Partial<PromoSlide>[] | undefined) =>
    Array.from({ length: SLIDE_COUNT }, (_, i) => ({ ...EMPTY, ...(list?.[i] ?? {}) }))
  return { farm: fill(saved.farm), restaurants: fill(saved.restaurants) }
}

export async function savePromoSlide(market: Marketplace, index: number, slide: PromoSlide, by: string) {
  const all = await getPromoSlides()
  all[market][index] = slide
  await db().collection('meta').doc('content').set({ promoSlides: all, promoSlidesUpdatedBy: by, promoSlidesUpdatedAt: new Date().toISOString() }, { merge: true })
}
