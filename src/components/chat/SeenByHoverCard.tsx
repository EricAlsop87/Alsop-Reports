'use client'

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { CheckCheck, Eye, Users, Clock, Shield } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar } from '@/components/ui/Avatar'
import UserPresenceBadge from './UserPresenceBadge'
import { useChat, formatAwayTime } from '@/lib/chat/chatContext'
import type { Message, ConversationMember, Agent } from './types'

export function formatSeenTime(readTimeStr?: string | null): string {
  if (!readTimeStr) return ''
  const date = new Date(readTimeStr)
  const now = new Date()
  const diffMs = Math.max(0, now.getTime() - date.getTime())
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHours = Math.floor(diffMin / 60)

  if (diffSec < 45) return 'Just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHours < 24) {
    const isSameDay =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear()
    const timeStr = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    return isSameDay ? `Today, ${timeStr}` : `Yesterday, ${timeStr}`
  }
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

interface SeenByHoverCardProps {
  message: Message
  conversationMembers?: ConversationMember[]
  isOwn?: boolean
  isGroupChannel?: boolean
  isDirectDM?: boolean
  otherMemberLastReadAt?: string | null
  children: React.ReactNode
  className?: string
  side?: 'top' | 'bottom'
}

export default function SeenByHoverCard({
  message,
  conversationMembers = [],
  isOwn = false,
  isGroupChannel = false,
  isDirectDM = false,
  otherMemberLastReadAt,
  children,
  className,
  side = 'top',
}: SeenByHoverCardProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'seen' | 'unread'>('seen')
  const [coords, setCoords] = useState({ top: 0, bottom: 0, left: 0, width: 0 })
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  let chat: any = null
  try {
    chat = useChat()
  } catch {}

  const currentAgent = chat?.currentAgent ?? null
  const getLivePresence = chat?.getLivePresence
  const getLiveLastSeen = chat?.getLiveLastSeen

  const msgTime = useMemo(() => new Date(message.created_at).getTime(), [message.created_at])

  // Filter other members (excluding sender)
  const otherMembers = useMemo(() => {
    return (conversationMembers || []).filter((m) => m.agent_id !== message.sender_id)
  }, [conversationMembers, message.sender_id])

  // Seen members list
  const seenMembers = useMemo(() => {
    return otherMembers
      .filter((m) => {
        if (!m.last_read_at) return false
        const readTime = new Date(m.last_read_at).getTime()
        return readTime >= msgTime - 1000
      })
      .sort((a, b) => {
        const timeA = a.last_read_at ? new Date(a.last_read_at).getTime() : 0
        const timeB = b.last_read_at ? new Date(b.last_read_at).getTime() : 0
        return timeB - timeA
      })
  }, [otherMembers, msgTime])

  // Unseen members list
  const unreadMembers = useMemo(() => {
    return otherMembers.filter((m) => {
      if (!m.last_read_at) return true
      const readTime = new Date(m.last_read_at).getTime()
      return readTime < msgTime - 1000
    })
  }, [otherMembers, msgTime])

  const updateCoords = useCallback(() => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    setCoords({
      top: rect.top,
      bottom: rect.bottom,
      left: rect.left,
      width: rect.width,
    })
  }, [])

  const handleMouseEnter = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      setIsOpen(true)
    }, 180)
  }, [])

  const handleMouseLeave = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      setIsOpen(false)
    }, 160)
  }, [])

  useEffect(() => {
    if (isOpen) {
      updateCoords()
      window.addEventListener('scroll', updateCoords, true)
      window.addEventListener('resize', updateCoords)
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      window.removeEventListener('scroll', updateCoords, true)
      window.removeEventListener('resize', updateCoords)
    }
  }, [isOpen, updateCoords])

  // If in direct DM (1-on-1)
  const isDirectDMSeen = useMemo(() => {
    if (!isDirectDM || !otherMemberLastReadAt) return false
    return new Date(otherMemberLastReadAt).getTime() >= msgTime - 1000
  }, [isDirectDM, otherMemberLastReadAt, msgTime])

  const directDMMember = useMemo(() => {
    if (!isDirectDM) return null
    return (conversationMembers || []).find((m) => m.agent_id !== currentAgent?.id)
  }, [isDirectDM, conversationMembers, currentAgent?.id])

  return (
    <div
      ref={containerRef}
      className={cn('relative inline-flex items-center', className)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={(e) => {
        e.stopPropagation()
        setIsOpen((prev) => !prev)
      }}
    >
      {children}

      {isOpen && typeof window !== 'undefined' && typeof document !== 'undefined' && createPortal(
        <div
          className={cn(
            'fixed z-[99999] w-72 sm:w-80 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200/90 dark:border-slate-800 text-left transition-all animate-in fade-in zoom-in-95 duration-150 select-none pointer-events-auto overflow-hidden'
          )}
          style={{
            top: side === 'top' ? undefined : coords.bottom + 6,
            bottom: side === 'top' ? window.innerHeight - coords.top + 6 : undefined,
            left: Math.max(12, Math.min(coords.left - 20, window.innerWidth - 330)),
          }}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Zero-gap invisible hover bridge */}
          <div
            className={cn(
              'absolute left-0 right-0 h-4',
              side === 'top' ? '-bottom-4' : '-top-4'
            )}
          />

          {/* Header */}
          <div className="bg-slate-50/90 dark:bg-slate-800/80 px-3.5 py-2.5 border-b border-slate-200/70 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={cn(
                'w-6 h-6 rounded-lg flex items-center justify-center',
                seenMembers.length > 0 || isDirectDMSeen
                  ? 'bg-blue-100 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
              )}>
                <CheckCheck className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                {isDirectDM
                  ? isDirectDMSeen
                    ? 'Read Receipt'
                    : 'Delivered'
                  : `Message Seen (${seenMembers.length}/${otherMembers.length})`}
              </span>
            </div>

            {/* In channels: Tab switcher if there are members */}
            {!isDirectDM && otherMembers.length > 0 && (
              <div className="flex items-center bg-slate-200/70 dark:bg-slate-700/60 p-0.5 rounded-lg text-[10px] font-semibold">
                <button
                  type="button"
                  onClick={() => setActiveTab('seen')}
                  className={cn(
                    'px-2 py-0.5 rounded-md transition-all cursor-pointer',
                    activeTab === 'seen'
                      ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-2xs font-bold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  )}
                >
                  Seen ({seenMembers.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('unread')}
                  className={cn(
                    'px-2 py-0.5 rounded-md transition-all cursor-pointer',
                    activeTab === 'unread'
                      ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-2xs font-bold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  )}
                >
                  Unread ({unreadMembers.length})
                </button>
              </div>
            )}
          </div>

          {/* Body Content */}
          <div className="p-2 max-h-64 overflow-y-auto space-y-1 divide-y divide-slate-100 dark:divide-slate-800/60">
            {/* 1-on-1 DM View */}
            {isDirectDM ? (
              <div className="p-2 space-y-2">
                <div className="flex items-center gap-2.5">
                  <div className="relative shrink-0 w-8 h-8">
                    <Avatar
                      name={directDMMember?.agent?.name || 'Recipient'}
                      url={directDMMember?.agent?.avatar_url}
                      className="w-8 h-8 text-xs shadow-xs"
                      fallbackClassName="w-8 h-8 text-xs shadow-xs"
                    />
                    {directDMMember?.agent?.id && (
                      <UserPresenceBadge
                        status={
                          getLivePresence
                            ? getLivePresence(directDMMember.agent.id, directDMMember.agent)
                            : (directDMMember.agent.presence || 'offline')
                        }
                        size="sm"
                        className="absolute -bottom-0.5 -right-0.5 ring-2 ring-white dark:ring-slate-900"
                      />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                        {directDMMember?.agent?.name || 'Recipient'}
                      </span>
                      {directDMMember?.agent?.team && (
                        <span className="text-[9px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-1.5 py-0.2 rounded">
                          {directDMMember.agent.team}
                        </span>
                      )}
                    </div>

                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1">
                      {isDirectDMSeen ? (
                        <>
                          <CheckCheck className="w-3 h-3 text-blue-500 shrink-0" />
                          <span className="text-blue-600 dark:text-blue-400 font-medium">
                            Seen {formatSeenTime(otherMemberLastReadAt)}
                          </span>
                        </>
                      ) : (
                        <>
                          <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>Delivered • Unread by recipient</span>
                        </>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              /* Channel / Group View */
              <>
                {activeTab === 'seen' ? (
                  seenMembers.length === 0 ? (
                    <div className="py-6 px-4 text-center select-none">
                      <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-2 text-slate-400">
                        <Clock className="w-4 h-4" />
                      </div>
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        No one has seen this yet
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Delivered to channel. Receipts will appear here as members view the message.
                      </p>
                    </div>
                  ) : (
                    seenMembers.map((m) => {
                      const agent = m.agent
                      const name = agent?.name || 'Team Member'
                      const presence = agent?.id && getLivePresence
                        ? getLivePresence(agent.id, agent)
                        : (agent?.presence || 'offline')
                      const lastSeen = agent?.id && getLiveLastSeen
                        ? getLiveLastSeen(agent.id, agent)
                        : agent?.last_seen_at

                      return (
                        <div
                          key={m.agent_id}
                          className="flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                        >
                          <div className="relative shrink-0 w-7 h-7">
                            <Avatar
                              name={name}
                              url={agent?.avatar_url}
                              className="w-7 h-7 text-[10px] shadow-xs"
                              fallbackClassName="w-7 h-7 text-[10px] shadow-xs"
                            />
                            <UserPresenceBadge
                              status={presence as any}
                              size="sm"
                              className="absolute -bottom-0.5 -right-0.5 ring-[1.5px] ring-white dark:ring-slate-900"
                            />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                                {name}
                              </span>
                              {agent?.role === 'admin' && (
                                <span className="inline-flex items-center text-[9px] font-bold px-1 py-0.2 rounded bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200/50">
                                  <Shield className="w-2 h-2 mr-0.5" />
                                  Admin
                                </span>
                              )}
                              {agent?.team && (
                                <span className="text-[9px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-1 py-0.2 rounded">
                                  {agent.team}
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400 flex items-center gap-1">
                              <span className="text-blue-600 dark:text-blue-400 font-medium">
                                Seen {formatSeenTime(m.last_read_at)}
                              </span>
                              {presence !== 'online' && lastSeen && (
                                <>
                                  <span>•</span>
                                  <span>{formatAwayTime(lastSeen, presence)}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })
                  )
                ) : (
                  /* Unread Tab */
                  unreadMembers.length === 0 ? (
                    <div className="py-6 px-4 text-center select-none">
                      <div className="w-9 h-9 rounded-full bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center mx-auto mb-2 text-emerald-500">
                        <CheckCheck className="w-4 h-4" />
                      </div>
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        All members have read this!
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Everyone in the channel is up to date.
                      </p>
                    </div>
                  ) : (
                    unreadMembers.map((m) => {
                      const agent = m.agent
                      const name = agent?.name || 'Team Member'
                      const presence = agent?.id && getLivePresence
                        ? getLivePresence(agent.id, agent)
                        : (agent?.presence || 'offline')
                      const lastSeen = agent?.id && getLiveLastSeen
                        ? getLiveLastSeen(agent.id, agent)
                        : agent?.last_seen_at

                      return (
                        <div
                          key={m.agent_id}
                          className="flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors opacity-80"
                        >
                          <div className="relative shrink-0 w-7 h-7">
                            <Avatar
                              name={name}
                              url={agent?.avatar_url}
                              className="w-7 h-7 text-[10px] shadow-xs"
                              fallbackClassName="w-7 h-7 text-[10px] shadow-xs"
                            />
                            <UserPresenceBadge
                              status={presence as any}
                              size="sm"
                              className="absolute -bottom-0.5 -right-0.5 ring-[1.5px] ring-white dark:ring-slate-900"
                            />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate">
                                {name}
                              </span>
                              {agent?.team && (
                                <span className="text-[9px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-1 py-0.2 rounded">
                                  {agent.team}
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400 flex items-center gap-1">
                              <span>Unread</span>
                              {presence && (
                                <>
                                  <span>•</span>
                                  <span>{formatAwayTime(lastSeen, presence)}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })
                  )
                )}
              </>
            )}
          </div>

          {/* Footer timestamp summary */}
          <div className="px-3 py-2 bg-slate-50/70 dark:bg-slate-900/90 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-400 flex items-center justify-between">
            <span>Sent {new Date(message.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
            {!isDirectDM && (
              <span className="font-semibold text-slate-500">
                {seenMembers.length} of {otherMembers.length} read
              </span>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
