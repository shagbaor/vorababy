'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { CheckmarkCircle02Icon, Download04Icon, File01Icon } from '@hugeicons/core-free-icons'
import { useAdminStore } from '@/components/admin/admin-store'
import { DisputeSummary } from '@/components/admin/dispute-card'
import { Avatar, EmptyState, ScreenHeader, useToast } from '@/components/admin/ui'
import { formatNairaExact } from '@/lib/admin/format'
import type { DisputeResolution } from '@/lib/admin/mock-data'

export default function DisputeDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { disputes, dispatch } = useAdminStore()
  const { toast, showToast } = useToast()
  const dispute = disputes.find((d) => d.id === id)

  // Opening an open dispute moves it into review.
  useEffect(() => {
    if (dispute?.status === 'open') dispatch({ type: 'dispute/review', id: dispute.id })
  }, [dispute?.id, dispute?.status, dispatch])

  if (!dispute) {
    return (
      <main className="px-[22px]">
        <ScreenHeader title="Dispute" backHref="/admin/disputes" />
        <div className="mt-6">
          <EmptyState>We couldn&apos;t find dispute {id}.</EmptyState>
        </div>
      </main>
    )
  }

  function resolve(resolution: DisputeResolution) {
    dispatch({ type: 'dispute/resolve', id: dispute!.id, resolution })
    router.push(`/admin/disputes?resolved=${resolution}`)
  }

  const resolved = dispute.status === 'resolved'

  return (
    <main className="px-6">
      {toast}
      <ScreenHeader title={dispute.id} backHref="/admin/disputes" />

      <div className="mt-6 flex flex-col gap-3">
        <section className="rounded-2xl border border-[#f3f4f6] bg-white p-[17px] tracking-[0.08px]">
          <DisputeSummary dispute={dispute} />
        </section>

        <section className="rounded-2xl border border-[#f3f4f6] bg-white p-[17px]">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-sm font-semibold leading-5 tracking-[-0.21px] text-[#111827]">{dispute.title}</h2>
            <span className="text-sm font-bold leading-5 text-[#111827]">{formatNairaExact(dispute.amount)}</span>
          </div>
          <p className="mt-2 text-xs leading-[19.5px] tracking-[0.08px] text-[#4b5563]">{dispute.summary}</p>
        </section>

        <Statement title="Buyer's Claim" name={dispute.buyerName} text={dispute.buyerClaim} className="bg-[#e5f5ec]" />
        <Statement title="Seller's Response" name={dispute.sellerName} text={dispute.sellerResponse} className="bg-[#fff7ed]" />

        <section className="rounded-2xl border border-[#f3f4f6] bg-white p-[17px]">
          <h2 className="text-sm font-medium leading-5 tracking-[-0.21px] text-[#111827]">Evidence ({dispute.evidence.length})</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {dispute.evidence.map((item) => (
              <li key={item} className="flex h-[52px] items-center gap-3 rounded-xl bg-[#f9fafb] px-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#e5e7eb] text-[#6b7280]">
                  <HugeiconsIcon icon={File01Icon} size={15} strokeWidth={1.8} />
                </span>
                <span className="flex-1 truncate text-xs font-medium tracking-[0.08px] text-[#374151]">{item}</span>
                <button
                  type="button"
                  aria-label={`Download ${item}`}
                  onClick={() => showToast('Evidence files will be downloadable once storage is connected.')}
                  className="rounded-md p-1 text-[#9ca3af] transition-colors hover:bg-gray-200 hover:text-[#4b5563]"
                >
                  <HugeiconsIcon icon={Download04Icon} size={15} strokeWidth={1.8} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-[390px] border-t border-[#f3f4f6] bg-white px-4 pt-[21px] pb-[max(12px,env(safe-area-inset-bottom))]">
        {resolved ? (
          <p className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#e5f5ec] text-sm font-semibold text-[#2e8b57]">
            <HugeiconsIcon icon={CheckmarkCircle02Icon} size={18} strokeWidth={2} />
            {dispute.resolution === 'refunded' ? 'Resolved · Buyer refunded' : 'Resolved · Released to seller'}
          </p>
        ) : (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => resolve('refunded')}
              className="h-12 flex-1 rounded-2xl bg-[#f9fafb] text-sm font-bold tracking-[0.07px] text-[#0f3d2e] transition-colors hover:bg-gray-100"
            >
              Refund Buyer
            </button>
            <button
              type="button"
              onClick={() => resolve('released')}
              className="h-12 flex-1 rounded-2xl bg-[#2e8b57] text-sm font-bold tracking-[0.07px] text-white transition-colors hover:bg-[#277a4c]"
            >
              Release to Seller
            </button>
          </div>
        )}
      </div>
    </main>
  )
}

function Statement({ title, name, text, className }: { title: string; name: string; text: string; className: string }) {
  return (
    <section className={`rounded-2xl p-4 ${className}`}>
      <div className="flex items-center gap-2">
        <Avatar name={name} size={24} shape="circle" />
        <p className="text-xs font-semibold leading-4 tracking-[0.08px] text-[#1f2937]">
          {title} <span className="font-normal text-[#6b7280]">· {name}</span>
        </p>
      </div>
      <p className="mt-2 text-xs leading-[19.5px] tracking-[0.08px] text-[#374151]">{text}</p>
    </section>
  )
}
