'use client'

import { useState, useTransition } from 'react'
import { useAdminStore } from '@/components/admin/admin-store'
import { useToast } from '@/components/admin/ui'
import { saveSlide } from '@/app/admin/banner-actions'
import type { Marketplace, PromoSlide } from '@/lib/server/promo-slides'

const input = 'h-10 w-full rounded-xl border border-[#e5e7eb] px-3 text-sm text-[#1e1e1e] outline-none focus:border-[#2e8b57]'
const label = 'mb-1 block text-[12px] font-medium text-[#4b5563]'

// The 3 swipeable promo slides on the buyer home screen, per marketplace.
export default function SlidesEditor({ initial }: { initial: Record<Marketplace, PromoSlide[]> }) {
  const { profile } = useAdminStore()
  const [market, setMarket] = useState<Marketplace>('restaurants')
  const [slides, setSlides] = useState(initial)
  const { toast, showToast } = useToast()

  return (
    <section className="mt-8 mb-10">
      <h2 className="text-base font-semibold text-[#1e1e1e]">Promo slides</h2>
      <p className="mt-1 text-[13px] text-[#6b7280]">
        The 3 swipeable pictures at the top of the buyer home screen, above the banner. Each marketplace has its own.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {(['restaurants', 'farm'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMarket(m)}
            className={`h-10 rounded-xl border text-sm font-medium ${market === m ? 'border-[#2e8b57] bg-[#e8f5ee] text-[#2e8b57]' : 'border-[#e5e7eb] text-[#4b5563]'}`}
          >
            {m === 'restaurants' ? 'Restaurants' : 'Farm market'}
          </button>
        ))}
      </div>
      {!profile.superAdmin && (
        <p className="mt-3 rounded-xl bg-[#fffbeb] p-3 text-[13px] text-[#78350f]">Only super admins can change the slides.</p>
      )}
      <div className="mt-4 flex flex-col gap-5">
        {slides[market].map((slide, index) => (
          <SlideForm
            key={`${market}-${index}`}
            market={market}
            index={index}
            slide={slide}
            disabled={!profile.superAdmin}
            onSaved={(saved) => {
              setSlides((all) => ({ ...all, [market]: all[market].map((s, i) => (i === index ? saved : s)) }))
              showToast(`Slide ${index + 1} saved. The app shows it on next refresh.`)
            }}
            onError={showToast}
          />
        ))}
      </div>
      {toast}
    </section>
  )
}

function SlideForm({
  market,
  index,
  slide,
  disabled,
  onSaved,
  onError,
}: {
  market: Marketplace
  index: number
  slide: PromoSlide
  disabled: boolean
  onSaved: (slide: PromoSlide) => void
  onError: (message: string) => void
}) {
  const [draft, setDraft] = useState(slide)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState(slide.imageUrl)
  const [pending, startTransition] = useTransition()

  function submit() {
    const form = new FormData()
    form.set('market', market)
    form.set('index', String(index))
    form.set('eyebrow', draft.eyebrow)
    form.set('title', draft.title)
    form.set('buttonText', draft.buttonText)
    form.set('link', draft.link ?? '')
    if (file) form.set('image', file)
    startTransition(async () => {
      const result = await saveSlide(form)
      if (result.ok) {
        setFile(null)
        setPreview(result.slide.imageUrl)
        onSaved(result.slide)
      } else onError(result.error)
    })
  }

  return (
    <fieldset disabled={disabled || pending} className="rounded-2xl border border-[#e5e7eb] p-3">
      <p className="mb-2 text-[13px] font-semibold text-[#1e1e1e]">Slide {index + 1}</p>
      <div className="relative overflow-hidden rounded-[18px] bg-[#f3f4f6]">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="aspect-[2.4/1] w-full object-cover" />
        ) : (
          <div className="flex aspect-[2.4/1] items-center justify-center text-[12px] text-[#9ca3af]">No picture yet</div>
        )}
        {preview && (
          <div className="absolute inset-0 flex flex-col justify-center gap-1 bg-gradient-to-r from-black/60 to-transparent p-4 text-white">
            {draft.eyebrow && <p className="text-[11px] opacity-90">{draft.eyebrow}</p>}
            {draft.title && <p className="text-lg font-semibold">{draft.title}</p>}
            <span className="mt-1 w-fit rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-[#1b4d3e]">{draft.buttonText || 'Shop Now'}</span>
          </div>
        )}
      </div>
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="mt-2 block w-full text-[12px]"
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null
          if (f && f.size > 4_000_000) return onError('The picture must be 4 MB or smaller.')
          setFile(f)
          setPreview(f ? URL.createObjectURL(f) : slide.imageUrl)
        }}
      />
      <div className="mt-2 grid gap-2">
        <div>
          <label className={label}>Small text above the title</label>
          <input className={input} maxLength={60} value={draft.eyebrow} onChange={(e) => setDraft({ ...draft, eyebrow: e.target.value })} />
        </div>
        <div>
          <label className={label}>Title</label>
          <input className={input} maxLength={40} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={label}>Button text</label>
            <input className={input} maxLength={20} value={draft.buttonText} onChange={(e) => setDraft({ ...draft, buttonText: e.target.value })} />
          </div>
          <div>
            <label className={label}>Link (optional)</label>
            <input className={input} placeholder="https://" value={draft.link ?? ''} onChange={(e) => setDraft({ ...draft, link: e.target.value || null })} />
          </div>
        </div>
      </div>
      <button type="button" onClick={submit} className="mt-3 h-10 w-full rounded-xl bg-[#2e8b57] text-sm font-semibold text-white disabled:opacity-60">
        {pending ? 'Saving…' : `Save slide ${index + 1}`}
      </button>
    </fieldset>
  )
}
