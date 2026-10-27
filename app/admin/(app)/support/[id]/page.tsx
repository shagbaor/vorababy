'use client'

import { useParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { Attachment01Icon, Mic01Icon, MoreVerticalIcon, SentIcon, Tick02Icon } from '@hugeicons/core-free-icons'
import { cn } from '@/lib/utils'
import { useAdminStore } from '@/components/admin/admin-store'
import { Avatar, BottomSheet, EmptyState, ScreenHeader, SheetButton, useToast } from '@/components/admin/ui'
import { currentTime } from '@/lib/admin/format'

export default function ConversationPage() {
  const { id } = useParams<{ id: string }>()
  const { conversations, users, disputes, orders, dispatch } = useAdminStore()
  const [draft, setDraft] = useState('')
  const [sheetOpen, setSheetOpen] = useState(false)
  const { toast, showToast } = useToast()
  const endRef = useRef<HTMLDivElement>(null)

  const conversation = conversations.find((c) => c.id === id)
  const user = users.find((u) => u.id === conversation?.userId)

  useEffect(() => {
    if (conversation && conversation.unread > 0) dispatch({ type: 'conversation/read', id: conversation.id })
  }, [conversation, dispatch])

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [conversation?.messages.length])

  if (!conversation || !user) {
    return (
      <main className="px-[22px]">
        <ScreenHeader title="Message" backHref="/admin/support" />
        <div className="mt-6">
          <EmptyState>We couldn&apos;t find this conversation.</EmptyState>
        </div>
      </main>
    )
  }

  function send(event: React.FormEvent) {
    event.preventDefault()
    const text = draft.trim()
    if (!text) return
    dispatch({ type: 'conversation/send', id: conversation!.id, text, time: currentTime() })
    setDraft('')
  }

  function closeConversation() {
    dispatch({ type: 'conversation/close', id: conversation!.id })
    setSheetOpen(false)
    showToast('Conversation closed.')
  }

  function refundAndClose() {
    const dispute = disputes.find((d) => d.orderId === conversation!.orderId && d.status !== 'resolved')
    if (dispute) dispatch({ type: 'dispute/resolve', id: dispute.id, resolution: 'refunded' })
    const order = orders.find((o) => o.id === conversation!.orderId)
    if (order) dispatch({ type: 'order/refund', id: order.id })
    dispatch({ type: 'conversation/close', id: conversation!.id })
    setSheetOpen(false)
    showToast(`Full refund issued for ${conversation!.orderId}. Conversation closed.`)
  }

  return (
    <main className="flex min-h-[calc(100dvh-110px)] flex-col px-6">
      {toast}
      <ScreenHeader
        backHref="/admin/support"
        title={
          <span className="flex items-center gap-2.5">
            <Avatar name={user.name} size={36} shape="circle" />
            <span className="flex flex-col">
              <span className="text-[16px] font-medium leading-5 tracking-normal text-[#1e1e1e]">{user.name}</span>
              <span className="text-[11px] font-normal leading-4 tracking-normal text-[#9ca3af]">
                {conversation.closed ? 'Closed' : 'Online'}
              </span>
            </span>
          </span>
        }
        trailing={
          !conversation.closed && (
            <button
              type="button"
              aria-label="Conversation options"
              onClick={() => setSheetOpen(true)}
              className="rounded-full p-1.5 text-[#6b7280] transition-colors hover:bg-gray-100"
            >
              <HugeiconsIcon icon={MoreVerticalIcon} size={20} strokeWidth={1.8} />
            </button>
          )
        }
      />

      <div className="mt-6 flex flex-1 flex-col gap-3">
        <p className="self-center rounded-full bg-[#f3f4f6] px-3 py-1 text-[11px] font-medium text-[#4b5563]">
          {conversation.orderId} · Today
        </p>
        {conversation.messages.map((message) => {
          const mine = message.from === 'admin'
          return (
            <div key={message.id} className={cn('flex max-w-[78%] flex-col gap-1', mine ? 'items-end self-end' : 'self-start')}>
              <p
                className={cn(
                  'rounded-2xl px-3 py-2.5 text-sm leading-[22px] tracking-[0.1px]',
                  mine ? 'rounded-br-md bg-[#2e8b57] text-white' : 'rounded-bl-md bg-[#f6f7f9] text-[#1e1e1e]',
                )}
              >
                {message.text}
              </p>
              <span className="flex items-center gap-1 text-[11px] text-[#9ca3af]">
                {message.time}
                {mine && <HugeiconsIcon icon={Tick02Icon} size={12} strokeWidth={2} className="text-[#2e8b57]" />}
              </span>
            </div>
          )
        })}
        <div ref={endRef} />
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-[390px] border-t border-[#f3f4f6] bg-[#fbfbfb] px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]">
        {conversation.closed ? (
          <p className="py-3 text-center text-xs text-[#6b7280]">This conversation is closed.</p>
        ) : (
          <form onSubmit={send} className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Attach file"
              onClick={() => showToast('Attachments will work once file storage is connected.')}
              className="rounded-full p-1.5 text-[#6b7280] hover:bg-gray-100"
            >
              <HugeiconsIcon icon={Attachment01Icon} size={20} strokeWidth={1.5} />
            </button>
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Type a message..."
              aria-label="Message"
              className="h-11 min-w-0 flex-1 rounded-full bg-white px-4 text-sm text-[#1e1e1e] outline-none ring-1 ring-[#f0f0f0] placeholder:text-[#9ca3af] focus:ring-[#2e8b57]/40"
            />
            {draft.trim() ? (
              <button
                type="submit"
                aria-label="Send"
                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#16a34a] text-white transition-colors hover:bg-[#15803d]"
              >
                <HugeiconsIcon icon={SentIcon} size={18} strokeWidth={1.8} />
              </button>
            ) : (
              <button
                type="button"
                aria-label="Record voice note"
                onClick={() => showToast('Voice notes are not available yet.')}
                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#f3f4f6] text-[#6b7280]"
              >
                <HugeiconsIcon icon={Mic01Icon} size={18} strokeWidth={1.5} />
              </button>
            )}
          </form>
        )}
      </div>

      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Close Dispute" subtitle={conversation.orderId}>
        <SheetButton variant="danger" onClick={closeConversation}>
          Close Conversation
        </SheetButton>
        <SheetButton variant="outline" onClick={refundAndClose}>
          Issue Full Refund to Buyer
        </SheetButton>
      </BottomSheet>
    </main>
  )
}
