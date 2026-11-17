import 'server-only'
import { db } from '@/lib/firebase/admin'

// The banner at the top of the buyer home screen (the "Flash Deals" card).
// Super admins change it on /admin/banner; it lives in meta/content.homeBanner.
export type HomeBanner = {
  enabled: boolean
  // 'image': a full-width picture (title/subtitle optional, drawn on top).
  // 'text':  a coloured card with a title and subtitle.
  kind: 'image' | 'text'
  title: string
  subtitle: string
  imageUrl: string | null
  // Hex colour for text banners, e.g. #F9A825.
  color: string
  // Optional countdown shown on the card until this time (ISO).
  endsAt: string | null
  // Optional web link opened when the banner is tapped.
  link: string | null
}

export const DEFAULT_HOME_BANNER: HomeBanner = {
  enabled: true,
  kind: 'text',
  title: 'Flash Deals',
  subtitle: 'Fresh picks from local farms every day',
  imageUrl: null,
  color: '#FDBA74',
  endsAt: null,
  link: null,
}

export async function getHomeBanner(): Promise<HomeBanner> {
  const snapshot = await db().collection('meta').doc('content').get()
  const saved = snapshot.get('homeBanner') as Partial<HomeBanner> | undefined
  return { ...DEFAULT_HOME_BANNER, ...saved }
}

export async function saveHomeBanner(banner: HomeBanner, by: string) {
  await db().collection('meta').doc('content').set({ homeBanner: { ...banner, updatedBy: by, updatedAt: new Date().toISOString() } }, { merge: true })
}
