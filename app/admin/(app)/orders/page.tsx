'use client'

import { useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { CheckmarkCircle02Icon, Flag02Icon } from '@hugeicons/core-free-icons'
import { cn } from '@/lib/utils'
import { useAdminStore } from '@/components/admin/admin-store'
import { BottomSheet, EmptyState, FilterTabs, Pill, ScreenHeader, SearchField, SheetButton, useToast } from '@/components/admin/ui'
import { formatNairaExact } from '@/lib/admin/format'
import type { Order } from '@/lib/admin/mock-data'

type Filter = 'all' | 'held' | 'released' | 'disputed'

export default function OrdersPage() {
  const { orders, dispatch } = useAdminStore()
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [resolving, setResolving] = useState<Order | null>(null)
  const { toast, showToast } = useToast()

  const count = (status: Order['status']) => orders.filter((o) => o.status === status).length
  const tabs = [
    { value: 'all' as const, label: 'All', count: orders.length },
    { value: 'held' as const, label: 'Held', count: count('held') },
    { value: 'released' as const, label: 'Released', count: count('released') },
    { value: 'disputed' as const, label: 'Dispute', count: count('disputed') },
  ]

  const q = query.trim().toLowerCase()
  const visible = orders
    .filter((o) => filter === 'all' || o.status === filter)
    .filter((o) => !q || o.id.toLowerCase().includes(q))

  function release(order: Order) {
    dispatch({ type: 'order/release', id: order.id })
    showToast(`Escrow for ${order.id} released to seller.`)
  }

  function refund(order: Order) {
    dispatch({ type: 'order/refund', id: order.id })
    showToast(`${order.id} refunded to buyer.`)
  }

  return (
    <main className="px-[22px]">
      {toast}
      <ScreenHeader title="Order Management" backHref="/admin" />

      <div className="mt-8 flex flex-col gap-5">
        <SearchField value={query} onChange={setQuery} placeholder="Search order ID, buyer, seller..." />
        <FilterTabs tabs={tabs} value={filter} onChange={setFilter} />

        {visible.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {visible.map((order) => (
              <li key={order.id}>
                <OrderCard
                  order={order}
                  onRelease={() => release(order)}
                  onRefund={() => refund(order)}
                  onResolve={() => setResolving(order)}
                  onToggleFlag={() => dispatch({ type: 'order/toggleFlag', id: order.id })}
                />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState>{q ? `No orders match “${query}”.` : 'No orders here yet.'}</EmptyState>
        )}
      </div>

      <BottomSheet
        open={resolving !== null}
        onClose={() => setResolving(null)}
        title="Resolve Dispute"
        subtitle={
          resolving && (
            <>
              {resolving.id} · <span className="font-bold">{formatNairaExact(resolving.amount)}</span>
            </>
          )
        }
      >
        <SheetButton
          variant="primary"
          onClick={() => {
            if (resolving) release(resolving)
            setResolving(null)
          }}
        >
          Release Escrow to Seller
        </SheetButton>
        <SheetButton
          variant="outline"
          onClick={() => {
            if (resolving) refund(resolving)
            setResolving(null)
          }}
        >
          Issue Full Refund to Buyer
        </SheetButton>
      </BottomSheet>
    </main>
  )
}

const statusPill = {
  held: <Pill tone="orange">Held</Pill>,
  released: <Pill tone="green">Released</Pill>,
  refunded: <Pill tone="grey">Refunded</Pill>,
  disputed: <Pill tone="red">Disputed</Pill>,
}

function OrderCard({
  order,
  onRelease,
  onRefund,
  onResolve,
  onToggleFlag,
}: {
  order: Order
  onRelease: () => void
  onRefund: () => void
  onResolve: () => void
  onToggleFlag: () => void
}) {
  const disputed = order.status === 'disputed'
  const settled = order.status === 'released' || order.status === 'refunded'

  return (
    <article
      className={cn(
        'overflow-hidden rounded-2xl border bg-white tracking-[0.08px]',
        order.flagged ? 'border-[#fecaca]' : 'border-[#f0f0f0]',
      )}
    >
      {order.flagged && (
        <p className="flex h-8 items-center gap-2 bg-[#fef2f2] px-4 text-xs font-semibold text-[#ef4444]">
          <HugeiconsIcon icon={Flag02Icon} size={13} strokeWidth={2} />
          Flagged for review
        </p>
      )}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium leading-5 text-[#111827]">{order.id}</p>
            <p className="mt-0.5 text-xs leading-4 text-[#9ca3af]">{order.placedAt}</p>
          </div>
          {statusPill[order.status]}
        </div>

        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-3 text-xs leading-4 text-[#6b7280]">
            <span>
              {order.items} {order.items === 1 ? 'item' : 'items'}
            </span>
            <span aria-hidden className="text-[#9ca3af]">
              ·
            </span>
            <span>{order.progress}</span>
          </div>
          <p className="text-base font-semibold leading-6 text-[#111827]">{formatNairaExact(order.amount)}</p>
        </div>

        <div className="mt-3">
          {settled ? (
            <p className="flex h-9 items-center justify-center gap-2 text-xs font-medium text-[#2e8b57]">
              <HugeiconsIcon icon={CheckmarkCircle02Icon} size={16} strokeWidth={2} />
              {order.status === 'released' ? 'Settled' : 'Refunded to buyer'}
            </p>
          ) : (
            <div className="flex gap-2">
              {disputed ? (
                <button
                  type="button"
                  onClick={onResolve}
                  className="h-9 flex-1 rounded-xl bg-[#ef4444] text-xs font-medium tracking-[0.06px] text-white transition-colors hover:bg-[#dc2626]"
                >
                  Resolve Dispute
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={onRefund}
                    className="h-9 flex-1 rounded-xl border border-[#fed7aa] text-xs font-medium tracking-[0.06px] text-[#ea580c] transition-colors hover:bg-[#fff7ed]"
                  >
                    Refund Buyer
                  </button>
                  <button
                    type="button"
                    onClick={onRelease}
                    className="h-9 flex-1 rounded-xl bg-[#0f3d2e] text-xs font-medium tracking-[0.06px] text-white transition-colors hover:bg-[#0b2f23]"
                  >
                    Release to Seller
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={onToggleFlag}
                aria-pressed={order.flagged}
                aria-label={order.flagged ? 'Remove flag' : 'Flag for review'}
                className={cn(
                  'flex size-9 shrink-0 items-center justify-center rounded-xl transition-colors',
                  order.flagged ? 'bg-[#fee2e2] text-[#ef4444]' : 'bg-[#f3f4f6] text-[#6b7280] hover:bg-gray-200',
                )}
              >
                <HugeiconsIcon icon={Flag02Icon} size={16} strokeWidth={1.8} className={cn(order.flagged && '[&_path]:fill-current')} />
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  )
}
