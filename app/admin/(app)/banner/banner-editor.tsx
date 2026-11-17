'use client'

import { useState, useTransition } from 'react'
import { useAdminStore } from '@/components/admin/admin-store'
import { ScreenHeader, useToast } from '@/components/admin/ui'
import { saveBanner } from '@/app/admin/banner-actions'
import type { HomeBanner } from '@/lib/server/home-banner'

const input = 'h-11 w-full rounded-xl border border-[#e5e7eb] px-3 text-sm text-[#1e1e1e] outline-none focus:border-[#2e8b57]'
const label = 'mb-1.5 block text-[13px] font-medium text-[#4b5563]'

// datetime-local wants "YYYY-MM-DDTHH:mm" in local time.
function toLocalInput(iso: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function BannerEditor({ initial }: { initial: HomeBanner }) {
  const { profile } = useAdminStore()
  const [banner, setBanner] = useState(initial)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(initial.imageUrl)
  const [removeImage, setRemoveImage] = useState(false)
  const [endsAt, setEndsAt] = useState(toLocalInput(initial.endsAt))
  const [pending, startTransition] = useTransition()
  const { toast, showToast } = useToast()
  const canEdit = profile.superAdmin

  function set<K extends keyof HomeBanner>(key: K, value: HomeBanner[K]) {
    setBanner((b) => ({ ...b, [key]: value }))
  }

  function pickFile(f: File | null) {
    if (f && f.size > 4_000_000) {
      showToast('The picture must be 4 MB or smaller.')
      return
    }
    setFile(f)
    setRemoveImage(false)
    setPreview(f ? URL.createObjectURL(f) : initial.imageUrl)
  }

  function submit() {
    const form = new FormData()
    form.set('enabled', banner.enabled ? '1' : '0')
    form.set('kind', banner.kind)
    form.set('title', banner.title)
    form.set('subtitle', banner.subtitle)
    form.set('color', banner.color)
    form.set('link', banner.link ?? '')
    form.set('endsAt', endsAt ? new Date(endsAt).toISOString() : '')
    if (file) form.set('image', file)
    if (removeImage) form.set('removeImage', '1')
    startTransition(async () => {
      const result = await saveBanner(form)
      if (result.ok) {
        setBanner(result.banner)
        setPreview(result.banner.imageUrl)
        setFile(null)
        setRemoveImage(false)
        showToast('Banner saved. The app shows it on next refresh.')
      } else {
        showToast(result.error)
      }
    })
  }

  const showImage = banner.kind === 'image' && preview && !removeImage

  return (
    <div className="px-4">
      <ScreenHeader title="Home banner" backHref="/admin" />
      <p className="mt-2 text-[13px] text-[#6b7280]">
        The card at the top of the buyer home screen in the app. Use it for deals or adverts.
      </p>

      {/* Preview, as it appears in the app */}
      <div className="mt-5">
        <p className={label}>Preview</p>
        {!banner.enabled ? (
          <div className="rounded-[20px] border border-dashed border-[#e5e7eb] p-6 text-center text-[13px] text-[#9ca3af]">
            Hidden in the app
          </div>
        ) : showImage ? (
          <div className="relative overflow-hidden rounded-[20px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview!} alt="" className="aspect-[3/1] w-full object-cover" />
            {(banner.title || banner.subtitle) && (
              <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/50 to-transparent p-4 text-white">
                {banner.title && <p className="text-base font-semibold">{banner.title}</p>}
                {banner.subtitle && <p className="text-xs opacity-90">{banner.subtitle}</p>}
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-[20px] p-4 text-white" style={{ backgroundColor: banner.color }}>
            <div className="min-w-0 flex-1">
              <p className="text-base font-semibold">{banner.title || 'Title'}</p>
              {banner.subtitle && <p className="text-xs opacity-90">{banner.subtitle}</p>}
            </div>
            {endsAt && <span className="rounded-lg bg-white/20 px-3 py-1.5 text-sm font-semibold">00:00:00</span>}
          </div>
        )}
      </div>

      {!canEdit && (
        <p className="mt-5 rounded-xl bg-[#fffbeb] p-3 text-[13px] text-[#78350f]">Only super admins can change the banner.</p>
      )}

      <fieldset disabled={!canEdit || pending} className="mt-5 flex flex-col gap-4">
        <label className="flex items-center justify-between rounded-xl border border-[#e5e7eb] px-3 py-3">
          <span className="text-sm text-[#1e1e1e]">Show the banner in the app</span>
          <input type="checkbox" checked={banner.enabled} onChange={(e) => set('enabled', e.target.checked)} className="size-5 accent-[#2e8b57]" />
        </label>

        <div>
          <span className={label}>Type</span>
          <div className="grid grid-cols-2 gap-2">
            {(['image', 'text'] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => set('kind', k)}
                className={`h-11 rounded-xl border text-sm font-medium ${banner.kind === k ? 'border-[#2e8b57] bg-[#e8f5ee] text-[#2e8b57]' : 'border-[#e5e7eb] text-[#4b5563]'}`}
              >
                {k === 'image' ? 'Picture' : 'Text'}
              </button>
            ))}
          </div>
        </div>

        {banner.kind === 'image' && (
          <div>
            <span className={label}>Picture (wide, about 3:1, up to 4 MB)</span>
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => pickFile(e.target.files?.[0] ?? null)} className="block w-full text-sm" />
            {preview && !removeImage && (
              <button type="button" onClick={() => { setRemoveImage(true); setFile(null) }} className="mt-2 text-xs text-[#ff3b3b]">
                Remove picture
              </button>
            )}
          </div>
        )}

        <div>
          <label className={label} htmlFor="b-title">{banner.kind === 'image' ? 'Title (optional, shown on the picture)' : 'Title'}</label>
          <input id="b-title" className={input} maxLength={60} value={banner.title} onChange={(e) => set('title', e.target.value)} />
        </div>
        <div>
          <label className={label} htmlFor="b-sub">Subtitle (optional)</label>
          <input id="b-sub" className={input} maxLength={120} value={banner.subtitle} onChange={(e) => set('subtitle', e.target.value)} />
        </div>

        {banner.kind === 'text' && (
          <div>
            <label className={label} htmlFor="b-color">Background colour</label>
            <div className="flex items-center gap-3">
              <input id="b-color" type="color" value={banner.color} onChange={(e) => set('color', e.target.value)} className="h-11 w-16 rounded-xl border border-[#e5e7eb]" />
              <span className="text-sm text-[#6b7280]">{banner.color}</span>
            </div>
          </div>
        )}

        <div>
          <label className={label} htmlFor="b-ends">Countdown until (optional)</label>
          <input id="b-ends" type="datetime-local" className={input} value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
        </div>
        <div>
          <label className={label} htmlFor="b-link">Link when tapped (optional, https://)</label>
          <input id="b-link" className={input} placeholder="https://" value={banner.link ?? ''} onChange={(e) => set('link', e.target.value || null)} />
        </div>

        <button
          type="button"
          onClick={submit}
          className="mt-2 mb-6 h-12 rounded-xl bg-[#2e8b57] text-sm font-semibold text-white disabled:opacity-60"
        >
          {pending ? 'Saving…' : 'Save banner'}
        </button>
      </fieldset>
      {toast}
    </div>
  )
}
