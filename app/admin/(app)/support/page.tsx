'use client'

import Link from 'next/link'
import { useAdminStore } from '@/components/admin/admin-store'
import { Avatar, EmptyState } from '@/components/admin/ui'
import { roleLabel } from '@/lib/admin/mock-data'

export default function SupportPage() {
  const { conversations, users } = useAdminStore()

  return (
    <main className="px-[22px]">
      <h1 className="pt-10 text-xl font-medium text-black">Message</h1>

      <div className="mt-5">
        {conversations.length > 0 ? (
          <ul className="flex flex-col">
            {conversations.map((conversation) => {
              const user = users.find((u) => u.id === conversation.userId)
              const last = conversation.messages[conversation.messages.length - 1]
              if (!user) return null

              return (
                <li key={conversation.id}>
                  <Link
                    href={`/admin/support/${conversation.id}`}
                    className="-mx-2 flex items-center gap-3 rounded-2xl px-2 py-3 transition-colors hover:bg-[#f9fafb]"
                  >
                    <Avatar name={user.name} size={40} shape="circle" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium text-[#1e1e1e]">{user.name}</p>
                        <span className="shrink-0 rounded bg-[#f3f4f6] px-1.5 py-px text-[9px] font-medium text-[#4b5563]">
                          {roleLabel[user.role]}
                        </span>
                        <span className="ml-auto shrink-0 text-[10px] text-[#9ca3af]">{conversation.lastActive}</span>
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <p className="flex-1 truncate text-[10px] text-[#9ca3af]">
                          {conversation.closed ? 'Conversation closed' : last ? `${last.from === 'admin' ? 'You: ' : ''}${last.text}` : 'No messages yet'}
                        </p>
                        {conversation.unread > 0 && (
                          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[#16a34a] text-[10px] font-semibold text-white">
                            {conversation.unread}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        ) : (
          <EmptyState>No support conversations yet.</EmptyState>
        )}
      </div>
    </main>
  )
}
