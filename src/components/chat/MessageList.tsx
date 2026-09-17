'use client'

import { useRef, useEffect, useMemo, useCallback, useState } from 'react'
import { ArrowDown, MessageSquare } from 'lucide-react'
import { cn } from '@/lib/utils'
import MessageBubble from './MessageBubble'
import type { Message, ConversationMember } from './types'

interface MessageListProps {
  messages: Message[]
  currentAgentId: string
  isLoading: boolean
  conversationMembers?: ConversationMember[]
  conversationType?: string
  onReply: (messageId: string) => void
  onEdit: (messageId: string, newContent: string) => Promise<void> | void
  onDelete: (messageId: string) => void
  onPin: (messageId: string) => void
  onReact: (messageId: string, emoji: string) => void
  hasPermission: (key: string) => boolean
  isCompact?: boolean
  typingAgents?: Array<{ agent_id: string; agent_name: string }>
}

function formatDateDivider(dateStr: string): string {
  const date = new Date(dateStr)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)

  const isToday =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()

  const isYesterday =
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate()

  if (isToday) return 'Today'
  if (isYesterday) return 'Yesterday'

  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
  })
}

function isSameDay(a: string, b: string): boolean {
  const d1 = new Date(a)
  const d2 = new Date(b)
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  )
}

/** Check whether two consecutive messages should be grouped (same sender, within 5 min) */
function shouldGroup(prev: Message, curr: Message): boolean {
  if (prev.sender_id !== curr.sender_id) return false
  if (prev.is_system || curr.is_system) return false
  if (prev.parent_message_id || curr.parent_message_id) return false // Replies should not be grouped
  const gap = new Date(curr.created_at).getTime() - new Date(prev.created_at).getTime()
  return gap < 5 * 60 * 1000 // 5 minutes
}

export default function MessageList({
  messages,
  currentAgentId,
  isLoading,
  conversationMembers = [],
  conversationType = 'direct',
  onReply,
  onEdit,
  onDelete,
  onPin,
  onReact,
  hasPermission,
  isCompact = false,
  typingAgents = [],
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [showScrollButton, setShowScrollButton] = useState(false)
  const [userScrolledUp, setUserScrolledUp] = useState(false)
  const isInitialLoadRef = useRef(true)

  const isDirectDM = conversationType === 'direct'

  // Find the other member in a 1-on-1 direct message
  const otherMember = useMemo(() => {
    if (!isDirectDM) return null
    return (conversationMembers || []).find((m) => m.agent_id !== currentAgentId)
  }, [isDirectDM, conversationMembers, currentAgentId])

  const otherMemberLastReadAt = otherMember?.last_read_at ?? null

  const scrollToBottom = useCallback((smooth = false) => {
    if (scrollContainerRef.current) {
      if (smooth) {
        scrollContainerRef.current.scrollTo({
          top: scrollContainerRef.current.scrollHeight,
          behavior: 'smooth',
        })
      } else {
        scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight
      }
    }
    bottomRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' })
    setShowScrollButton(false)
  }, [])

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (isLoading) return

    if (isInitialLoadRef.current) {
      scrollToBottom(false)
      isInitialLoadRef.current = false
      return
    }

    if (!userScrolledUp) {
      scrollToBottom(true)
    }
  }, [messages.length, isLoading, userScrolledUp, scrollToBottom])

  // Track scroll position
  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current
    if (!el) return
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    const isNearBottom = distanceFromBottom < 80
    setShowScrollButton(!isNearBottom)
    setUserScrolledUp(!isNearBottom)
  }, [])

  // Filter out deleted messages before rendering and grouping
  const activeMessages = useMemo(() => {
    return messages.filter(m => !m.is_deleted)
  }, [messages])

  // Build grouped message list with date dividers
  const renderedMessages = useMemo(() => {
    const result: React.ReactNode[] = []

    activeMessages.forEach((msg, idx) => {
      const prev = idx > 0 ? activeMessages[idx - 1] : null

      // Modern Frosted Glass Date divider
      if (!prev || !isSameDay(prev.created_at, msg.created_at)) {
        result.push(
          <div
            key={`date-${msg.created_at}`}
            className="flex items-center gap-3 px-6 py-4 select-none"
          >
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-700 to-transparent" />
            <span className="bg-slate-100/90 dark:bg-slate-800/90 backdrop-blur-md px-3 py-1 rounded-full text-[11px] font-bold text-slate-500 dark:text-slate-400 shadow-2xs border border-slate-200/60 dark:border-slate-700/60 uppercase tracking-wider">
              {formatDateDivider(msg.created_at)}
            </span>
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-700 to-transparent" />
          </div>
        )
      }

      const isGrouped = prev !== null && isSameDay(prev.created_at, msg.created_at) && shouldGroup(prev, msg)

      result.push(
        <MessageBubble
          key={msg.id}
          message={msg}
          currentAgentId={currentAgentId}
          isGrouped={isGrouped}
          isGroupChannel={conversationType === 'channel'}
          isDirectDM={isDirectDM}
          otherMemberLastReadAt={otherMemberLastReadAt}
          onReply={onReply}
          onEdit={onEdit}
          onDelete={onDelete}
          onPin={onPin}
          onReact={onReact}
          hasPermission={hasPermission}
        />
      )
    })

    return result
  }, [
    activeMessages,
    currentAgentId,
    conversationType,
    isDirectDM,
    otherMemberLastReadAt,
    onReply,
    onEdit,
    onDelete,
    onPin,
    onReact,
    hasPermission,
  ])

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="flex-1 p-4 space-y-4 overflow-hidden">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex gap-3 animate-pulse">
            <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <div className="h-3 w-20 bg-slate-200 dark:bg-slate-700 rounded" />
                <div className="h-3 w-12 bg-slate-100 dark:bg-slate-800 rounded" />
              </div>
              <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-3/4" />
              {i % 3 === 0 && <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-1/2" />}
            </div>
          </div>
        ))}
      </div>
    )
  }

  // Empty state
  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 select-none">
        <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center mb-4 shadow-sm">
          <MessageSquare className="w-7 h-7 text-blue-500" />
        </div>
        <h3 className="text-base font-bold text-slate-800 dark:text-slate-200 mb-1">
          No messages yet
        </h3>
        <p className="text-sm text-slate-400 text-center max-w-[280px]">
          Start the conversation! Send a message or react to connect with your team.
        </p>
      </div>
    )
  }

  // Filter typing agents to exclude yourself
  const externalTyping = typingAgents.filter(a => a.agent_id !== currentAgentId)

  return (
    <div className="relative flex-1 min-h-0">
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="absolute inset-0 overflow-y-auto py-2 space-y-0.5"
      >
        {renderedMessages}

        {/* Live Animated Typing Indicator */}
        {externalTyping.length > 0 && (
          <div className="flex items-center gap-2 px-6 py-2 animate-in fade-in slide-in-from-bottom-2 duration-150">
            <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700/60 rounded-full px-3.5 py-1.5 text-xs text-slate-600 dark:text-slate-300 shadow-xs">
              <span className="flex gap-1 items-center">
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" />
              </span>
              <span className="font-medium">
                {externalTyping.length === 1
                  ? `${externalTyping[0].agent_name} is typing...`
                  : `${externalTyping.length} people are typing...`}
              </span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Modern Floating Scroll to bottom button */}
      {showScrollButton && (
        <button
          onClick={() => scrollToBottom(true)}
          className="absolute bottom-4 right-6 w-10 h-10 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full shadow-lg flex items-center justify-center text-slate-500 hover:text-blue-600 hover:border-blue-300 hover:scale-110 active:scale-95 transition-all z-20 cursor-pointer"
          title="Jump to latest messages"
        >
          <ArrowDown className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}
