'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  Search,
  Hash,
  Plus,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Circle,
  Pin,
  Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import UserPresenceBadge from './UserPresenceBadge'
import { Avatar, getAvatarColor } from "@/components/ui/Avatar"
import type { Agent, Conversation, PresenceStatus } from './types'
import { useChat, formatAwayTime } from '@/lib/chat/chatContext'

interface ConversationSidebarProps {
  conversations: Conversation[]
  selectedId: string | null
  unreadCounts: Record<string, number>
  currentAgent: Agent
  onSelect: (conversationId: string) => void
  onCreateNew: (defaultTab?: 'dm' | 'group' | 'channel') => void
  onStatusChange: (status: PresenceStatus) => void
  onTogglePin: (conversationId: string, currentlyPinned: boolean) => void
  className?: string
}

function getDmDisplayName(conversation: Conversation, currentAgentId: string): string {
  if (conversation.type === 'direct_dm' && conversation.members) {
    const other = conversation.members.find((m) => m.agent_id !== currentAgentId)
    return other?.agent?.name ?? conversation.name ?? 'Direct Message'
  }
  if (conversation.type === 'group_dm') {
    if (conversation.name && conversation.name.trim()) {
      return conversation.name
    }
    if (conversation.members) {
      const others = conversation.members.filter((m) => m.agent_id !== currentAgentId)
      if (others.length <= 3) {
        return others.map((o) => o.agent?.name?.split(' ')[0] ?? '?').join(', ')
      }
      return `${others.slice(0, 2).map((o) => o.agent?.name?.split(' ')[0] ?? '?').join(', ')} +${others.length - 2}`
    }
    return conversation.name ?? 'Group Chat'
  }
  return conversation.name ?? 'Conversation'
}

function getMessagePreviewText(content?: string): string {
  if (!content) return ''
  const clean = content.replace(/<[^>]*>/g, '').trim()
  if (!clean) return ''
  if (clean.startsWith('data:image/') || clean.match(/\.(jpeg|jpg|gif|png|webp)($|\?)/i)) {
    return '📷 Image'
  }
  if (clean.includes('giphy.com') || clean.includes('tenor.com')) {
    return '🎬 GIF'
  }
  return clean.replace(/\s+/g, ' ')
}

const STATUS_OPTIONS: { value: PresenceStatus; label: string; color: string }[] = [
  { value: 'online', label: 'Online', color: 'bg-emerald-500' },
  { value: 'away', label: 'Away', color: 'bg-amber-500' },
  { value: 'busy', label: 'Busy', color: 'bg-rose-500' },
  { value: 'offline', label: 'Offline', color: 'bg-slate-400' },
]

export default function ConversationSidebar({
  conversations,
  selectedId,
  unreadCounts,
  currentAgent,
  onSelect,
  onCreateNew,
  onStatusChange,
  onTogglePin,
  className,
}: ConversationSidebarProps) {
  const [search, setSearch] = useState('')
  const [channelsOpen, setChannelsOpen] = useState(true)
  const [dmsOpen, setDmsOpen] = useState(true)
  const { getLivePresence, getLiveLastSeen } = useChat()

  const getDmPresence = (conversation: Conversation, currentAgentId: string): PresenceStatus => {
    if (conversation.type === 'direct_dm' && conversation.members) {
      const other = conversation.members.find((m) => m.agent_id !== currentAgentId)
      if (other?.agent_id) {
        return getLivePresence ? getLivePresence(other.agent_id, other?.agent) : ((other?.agent?.presence as any) ?? 'offline')
      }
      return (other?.agent?.presence as any) ?? 'offline'
    }
    return 'offline'
  }

  const channels = useMemo(() => {
    const list = conversations.filter((c) => c.type === 'channel')
    return list.sort((a, b) => {
      // 1. Pinned channels first
      if (a.is_pinned && !b.is_pinned) return -1
      if (!a.is_pinned && b.is_pinned) return 1

      // 2. 'All' channel always comes first among unpinned (or top of pinned if pinned)
      const isAllA = a.name?.trim().toLowerCase() === 'all'
      const isAllB = b.name?.trim().toLowerCase() === 'all'
      if (isAllA && !isAllB) return -1
      if (!isAllA && isAllB) return 1

      // 3. Otherwise sort by last message / activity time descending
      const aTime = a.last_message?.created_at ?? a.updated_at
      const bTime = b.last_message?.created_at ?? b.updated_at
      return new Date(bTime).getTime() - new Date(aTime).getTime()
    })
  }, [conversations])

  const directMessages = useMemo(
    () => conversations.filter((c) => c.type === 'direct_dm' || c.type === 'group_dm'),
    [conversations]
  )

  const filteredChannels = useMemo(() => {
    if (!search.trim()) return channels
    const q = search.toLowerCase()
    return channels.filter((c) => (c.name ?? '').toLowerCase().includes(q))
  }, [channels, search])

  const filteredDMs = useMemo(() => {
    if (!search.trim()) return directMessages
    const q = search.toLowerCase()
    return directMessages.filter((c) => {
      const displayName = getDmDisplayName(c, currentAgent.id)
      return displayName.toLowerCase().includes(q)
    })
  }, [directMessages, search, currentAgent.id])

  return (
    <div className={cn("w-full md:w-[280px] md:min-w-[280px] flex flex-col bg-white border-b md:border-b-0 md:border-r border-slate-200 h-full shrink-0", className)}>
      {/* Mobile Top Navigation back to Dashboard */}
      <div className="md:hidden flex items-center justify-between px-3 py-2.5 border-b border-slate-100 bg-slate-50/80 shrink-0">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 active:scale-95 transition-all py-1 px-2 rounded-lg bg-white border border-slate-200/80 shadow-2xs"
          title="Back to Dashboard"
        >
          <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
          <span>Dashboard</span>
        </Link>
        <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
          Communication
        </span>
      </div>

      {/* Search */}
      <div className="p-3 border-b border-slate-100">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all"
          />
        </div>
      </div>

      {/* Lists */}
      <div className="flex-1 overflow-y-auto py-2">
        {/* Channels section */}
        <div className="px-3 mb-1">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider py-1.5 px-1">
            <button
              onClick={() => setChannelsOpen(!channelsOpen)}
              className="flex items-center gap-1.5 hover:text-slate-600 transition-colors"
            >
              {channelsOpen ? (
                <ChevronDown className="w-3 h-3" />
              ) : (
                <ChevronRight className="w-3 h-3" />
              )}
              <span>Channels</span>
            </button>
            <button
              onClick={() => onCreateNew('channel')}
              className="p-0.5 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 transition-colors"
              title="Create channel"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {channelsOpen && (
          <div className="px-2 mb-4 space-y-0.5">
            {filteredChannels.map((conv) => {
              const unread = unreadCounts[conv.id] ?? 0
              const isSelected = selectedId === conv.id
              return (
                <button
                  key={conv.id}
                  onClick={() => onSelect(conv.id)}
                  className={cn(
                    'group/item w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all duration-200',
                    isSelected
                      ? 'bg-blue-50 text-blue-700 font-semibold ring-1 ring-blue-600/10'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                    unread > 0 && !isSelected && 'font-semibold text-slate-900'
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Hash className={cn("w-4 h-4 shrink-0 transition-colors", isSelected ? "text-blue-600" : "text-slate-400 group-hover/item:text-slate-600")} />
                    <span className="truncate">{conv.name}</span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <span
                      role="button"
                      onClick={(e) => { e.stopPropagation(); onTogglePin(conv.id, !!conv.is_pinned) }}
                      className={cn(
                        'w-5 h-5 flex items-center justify-center rounded transition-all',
                        conv.is_pinned
                          ? 'text-amber-500 hover:text-amber-600'
                          : 'text-slate-300 opacity-0 group-hover/item:opacity-100 hover:text-amber-500'
                      )}
                      title={conv.is_pinned ? 'Unpin' : 'Pin'}
                    >
                      <Pin className={cn('w-3 h-3', conv.is_pinned && 'fill-current')} />
                    </span>

                    {unread > 0 && (
                      <span className="bg-blue-600 text-white text-[10px] font-bold min-w-[18px] h-[18px] flex items-center justify-center rounded-full px-1 shrink-0">
                        {unread > 99 ? '99+' : unread}
                      </span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {/* Direct Messages section */}
        <div className="px-3 mb-1">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider py-1.5 px-1">
            <button
              onClick={() => setDmsOpen(!dmsOpen)}
              className="flex items-center gap-1.5 hover:text-slate-600 transition-colors"
            >
              {dmsOpen ? (
                <ChevronDown className="w-3 h-3" />
              ) : (
                <ChevronRight className="w-3 h-3" />
              )}
              <span>Direct Messages</span>
            </button>
            <button
              onClick={() => onCreateNew('dm')}
              className="p-0.5 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 transition-colors"
              title="New conversation"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {dmsOpen && (
          <div className="px-2 pb-2 space-y-0.5">
            {filteredDMs.map((conv) => {
              const unread = unreadCounts[conv.id] ?? 0
              const isSelected = selectedId === conv.id
              const displayName = getDmDisplayName(conv, currentAgent.id)
              const presence = getDmPresence(conv, currentAgent.id)

              const otherMember = conv.type === 'direct_dm' && conv.members
                ? conv.members.find((m) => m.agent_id !== currentAgent.id)?.agent
                : null
              const otherId = otherMember?.id
              const lastSeenAt = otherId && getLiveLastSeen ? getLiveLastSeen(otherId, otherMember) : otherMember?.last_seen_at
              const awayTimeText = formatAwayTime(lastSeenAt, presence)

              return (
                <button
                  key={conv.id}
                  onClick={() => onSelect(conv.id)}
                  title={conv.type === 'direct_dm' ? `${displayName} • ${awayTimeText}` : displayName}
                  className={cn(
                    'group/item w-full flex items-start text-left gap-2.5 px-3 py-2 rounded-md text-sm transition-all duration-200',
                    isSelected
                      ? 'bg-blue-50 text-blue-700 font-semibold ring-1 ring-blue-600/10'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                    unread > 0 && !isSelected && 'font-semibold text-slate-900'
                  )}
                >
                  {/* Avatar with presence */}
                  <div className="relative shrink-0 mt-0.5">
                    {conv.type === 'direct_dm' && conv.members ? (() => {
                      return <Avatar name={otherMember?.name || displayName} url={otherMember?.avatar_url} className="w-8 h-8 text-xs shadow-none" fallbackClassName="w-8 h-8 text-xs shadow-none" />
                    })() : (
                      <div
                        className={cn(
                          'w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold',
                          getAvatarColor(displayName)
                        )}
                      >
                        {conv.type === 'group_dm' ? (
                          <Users className="w-4 h-4" />
                        ) : (
                          displayName.charAt(0).toUpperCase()
                        )}
                      </div>
                    )}
                    {conv.type === 'direct_dm' && (
                      <div className="absolute -bottom-0.5 -right-0.5" title={awayTimeText}>
                        <UserPresenceBadge status={presence} size="sm" />
                      </div>
                    )}
                  </div>

                  {/* Name + subtitle */}
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex items-center gap-1.5 text-left">
                      <span className="truncate text-left leading-tight">{displayName}</span>
                      {conv.type === 'group_dm' && conv.members && conv.members.length > 0 && (
                        <span className="shrink-0 text-[10px] font-medium text-slate-400 bg-slate-100 rounded px-1 py-px leading-tight">
                          {conv.members.length}
                        </span>
                      )}
                    </div>
                    {/* Subtitle: member names for groups, last message or away duration for DMs */}
                    {conv.type === 'group_dm' && conv.members && conv.members.length > 0 ? (
                      <p className="text-[11px] text-slate-400 truncate mt-0.5 font-normal leading-tight text-left">
                        {conv.members
                          .filter((m) => m.agent_id !== currentAgent.id)
                          .map((m) => m.agent?.name?.split(' ')[0] ?? '?')
                          .join(', ')}
                      </p>
                    ) : conv.last_message ? (
                      <p className="text-[11px] text-slate-400 truncate mt-0.5 font-normal leading-tight text-left">
                        {getMessagePreviewText(conv.last_message.content)}
                      </p>
                    ) : (
                      <p className={cn(
                        "text-[10px] truncate mt-0.5 font-medium leading-tight text-left",
                        presence === 'online' && "text-emerald-600 dark:text-emerald-400",
                        presence === 'away' && "text-amber-600 dark:text-amber-400",
                        (presence === 'busy' || presence === 'offline') && "text-slate-400"
                      )}>
                        {awayTimeText}
                      </p>
                    )}
                  </div>

                  {/* Pin + Unread */}
                  <div className="flex items-center gap-1 shrink-0 mt-0.5">
                    <span
                      role="button"
                      onClick={(e) => { e.stopPropagation(); onTogglePin(conv.id, !!conv.is_pinned) }}
                      className={cn(
                        'w-5 h-5 flex items-center justify-center rounded transition-all',
                        conv.is_pinned
                          ? 'text-amber-500 hover:text-amber-600'
                          : 'text-slate-300 opacity-0 group-hover/item:opacity-100 hover:text-amber-500'
                      )}
                      title={conv.is_pinned ? 'Unpin' : 'Pin'}
                    >
                      <Pin className={cn('w-3 h-3', conv.is_pinned && 'fill-current')} />
                    </span>
                    {unread > 0 && (
                      <span className="bg-blue-600 text-white text-[10px] font-bold min-w-[18px] h-[18px] flex items-center justify-center rounded-full px-1 shrink-0">
                        {unread > 99 ? '99+' : unread}
                      </span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Current User Footer */}
      <div className="border-t border-slate-100 p-3">
        <div className="flex items-center gap-2.5">
          <Avatar name={currentAgent.name} url={currentAgent.avatar_url} className="w-8 h-8 text-xs shadow-sm" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-800 truncate leading-tight">
              {currentAgent.name}
            </p>
            <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
              <span
                className={cn(
                  "w-2 h-2 rounded-full shrink-0",
                  currentAgent.presence === 'online' && "bg-emerald-500",
                  currentAgent.presence === 'away' && "bg-amber-500",
                  currentAgent.presence === 'busy' && "bg-rose-500",
                  (!currentAgent.presence || currentAgent.presence === 'offline') && "bg-slate-400"
                )}
              />
              <span className="capitalize">{currentAgent.presence || 'Online'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
