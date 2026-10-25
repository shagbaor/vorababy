import Link from 'next/link'
import { Pill } from '@/components/admin/ui'
import { formatNairaExact } from '@/lib/admin/format'
import type { Dispute } from '@/lib/admin/mock-data'

export const disputeStatusLabel = {
  open: 'Open',
  in_review: 'In Review',
  resolved: 'Resolved',
} as const

const disputeStatusTone = {
  open: 'red',
  in_review: 'orange',
  resolved: 'green',
} as const

export function DisputeStatusPill({ status }: { status: Dispute['status'] }) {
  return (
    <Pill tone={disputeStatusTone[status]} className="px-2 py-0.5">
      {disputeStatusLabel[status]}
    </Pill>
  )
}

export function DisputeSummary({ dispute }: { dispute: Dispute }) {
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold leading-4 text-[#6b7280]">{dispute.id}</p>
          <p className="mt-0.5 truncate text-sm font-semibold leading-5 text-[#111827]">{dispute.title}</p>
        </div>
        <DisputeStatusPill status={dispute.status} />
      </div>
      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs leading-4 text-[#6b7280]">
          <span>{dispute.orderId}</span>
          <span aria-hidden className="text-[#9ca3af]">
            ·
          </span>
          <span>{dispute.openedAgo}</span>
        </div>
        <span className="text-sm font-semibold leading-5 text-[#111827]">{formatNairaExact(dispute.amount)}</span>
      </div>
    </>
  )
}

export function DisputeCard({ dispute }: { dispute: Dispute }) {
  return (
    <Link
      href={`/admin/disputes/${dispute.id}`}
      className="block rounded-2xl border border-[#f3f4f6] bg-white p-[17px] tracking-[0.08px] transition-colors hover:border-[#e5e7eb] hover:bg-[#fcfcfc]"
    >
      <DisputeSummary dispute={dispute} />
    </Link>
  )
}
