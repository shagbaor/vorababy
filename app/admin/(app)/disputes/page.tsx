'use client'

import { useEffect, useState } from 'react'
import { useAdminStore } from '@/components/admin/admin-store'
import { DisputeCard } from '@/components/admin/dispute-card'
import { EmptyState, FilterTabs, ScreenHeader, useToast } from '@/components/admin/ui'
import type { DisputeStatus } from '@/lib/admin/mock-data'

const resolvedMessages: Record<string, string> = {
  refunded: 'Refund issued to buyer. Dispute resolved.',
  released: 'Escrow released to seller. Dispute resolved.',
}

export default function DisputesPage() {
  const { disputes } = useAdminStore()
  const [filter, setFilter] = useState<DisputeStatus>('open')
  const { toast, showToast } = useToast()

  // The detail screen sends us back here with ?resolved=… after an action.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const resolved = params.get('resolved')
    if (resolved && resolvedMessages[resolved]) {
      showToast(resolvedMessages[resolved])
      setFilter('resolved')
      window.history.replaceState(null, '', window.location.pathname)
    }
  }, [showToast])

  const count = (status: DisputeStatus) => disputes.filter((d) => d.status === status).length
  const tabs = [
    { value: 'open' as const, label: 'Open', count: count('open') },
    { value: 'in_review' as const, label: 'In Review', count: count('in_review') },
    { value: 'resolved' as const, label: 'Resolved', count: count('resolved') },
  ]
  const visible = disputes.filter((d) => d.status === filter)

  return (
    <main className="px-[22px]">
      {toast}
      <ScreenHeader title="Dispute" backHref="/admin" />

      <div className="mt-6 flex flex-col gap-5">
        <FilterTabs tabs={tabs} value={filter} onChange={setFilter} activeClassName="bg-[#2e8b57]" />

        {visible.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {visible.map((dispute) => (
              <li key={dispute.id}>
                <DisputeCard dispute={dispute} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState>No {tabs.find((t) => t.value === filter)!.label.toLowerCase()} disputes.</EmptyState>
        )}
      </div>
    </main>
  )
}
