'use server'

import { revalidatePath } from 'next/cache'
import { getAdminSession } from '@/lib/admin/session'
import { ApiError } from '@/lib/api/response'
import { DEFAULT_HOME_BANNER, getHomeBanner, saveHomeBanner, type HomeBanner } from '@/lib/server/home-banner'
import { uploadPublicImage } from '@/lib/server/storage'

export type BannerResult = { ok: true; banner: HomeBanner } | { ok: false; error: string }

const COLOR = /^#[0-9a-fA-F]{6}$/

function text(form: FormData, key: string, max: number) {
  return String(form.get(key) ?? '').trim().slice(0, max)
}

// Saves the buyer home banner. Super admins only. The form may carry a new
// picture ("image"); otherwise the current picture is kept unless "removeImage".
export async function saveBanner(form: FormData): Promise<BannerResult> {
  const session = await getAdminSession()
  if (!session) return { ok: false, error: 'Your session has expired. Sign in again.' }
  if (!session.superAdmin) return { ok: false, error: 'Only super admins can change the home banner.' }

  try {
    const current = await getHomeBanner()
    const kind = form.get('kind') === 'image' ? 'image' : 'text'
    const color = text(form, 'color', 7)
    const endsAtRaw = text(form, 'endsAt', 40)
    const endsAt = endsAtRaw ? new Date(endsAtRaw) : null
    const link = text(form, 'link', 300)

    if (link && !/^https:\/\/\S+$/.test(link)) return { ok: false, error: 'The link must start with https://' }
    if (endsAt && Number.isNaN(endsAt.getTime())) return { ok: false, error: 'Choose a valid end time for the countdown' }

    let imageUrl = form.get('removeImage') === '1' ? null : current.imageUrl
    const file = form.get('image')
    if (file instanceof File && file.size > 0) {
      imageUrl = await uploadPublicImage('banners', Buffer.from(await file.arrayBuffer()), file.type)
    }

    const banner: HomeBanner = {
      enabled: form.get('enabled') === '1',
      kind,
      title: text(form, 'title', 60),
      subtitle: text(form, 'subtitle', 120),
      imageUrl,
      color: COLOR.test(color) ? color : DEFAULT_HOME_BANNER.color,
      endsAt: endsAt ? endsAt.toISOString() : null,
      link: link || null,
    }
    if (banner.kind === 'image' && !banner.imageUrl) return { ok: false, error: 'Upload a picture for an image banner' }
    if (banner.kind === 'text' && !banner.title) return { ok: false, error: 'Enter a title for a text banner' }

    await saveHomeBanner(banner, session.uid)
    revalidatePath('/admin/banner')
    return { ok: true, banner }
  } catch (error) {
    if (error instanceof ApiError) return { ok: false, error: error.message }
    console.error('saveBanner', error)
    return { ok: false, error: 'Could not save the banner. Try again.' }
  }
}
