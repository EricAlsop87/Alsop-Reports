'use client'

import { useState, useMemo, useCallback, Fragment } from 'react'
import {
  Reply,
  Smile,
  Pin,
  Pencil,
  Trash2,
  MoreHorizontal,
  AlertTriangle,
  AlertCircle,
  ExternalLink,
  Plus,
  Check,
  CheckCheck,
  Sparkles,
  FileText,
  File,
  Download,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Eye,
  Copy,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useChat } from '@/lib/chat/chatContext'
import { triggerConfetti } from '@/lib/chat/confetti'
import type { Message, Reaction, Agent, ConversationMember } from './types'
import UserPresenceBadge from './UserPresenceBadge'
import UserHoverCard from './UserHoverCard'
import SeenByHoverCard from './SeenByHoverCard'
import EmojiReactionPicker, { QUICK_REACTIONS } from './EmojiReactionPicker'

interface MessageBubbleProps {
  message: Message
  currentAgentId: string
  isGrouped: boolean
  isGroupChannel?: boolean
  isDirectDM?: boolean
  conversationMembers?: ConversationMember[]
  otherMemberLastReadAt?: string | null
  onReply: (messageId: string) => void
  onEdit: (messageId: string, newContent: string) => Promise<void> | void
  onDelete: (messageId: string) => void
  onPin: (messageId: string) => void
  onReact: (messageId: string, emoji: string) => void
  hasPermission: (key: string) => boolean
}

import { Avatar } from "@/components/ui/Avatar"

function formatTime(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function parseStatusMessage(msg: string | null): { emoji: string | null; text: string | null } {
  if (!msg) return { emoji: null, text: null }
  
  const emojiRegex = /^([\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F000}-\u{1F02F}]|[\u{1F0A0}-\u{1F0FF}]|[\u{1F100}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F900}-\u{1F9FF}]|[\u{1F300}-\u{1F5FF}])/u
  const match = msg.match(emojiRegex)
  if (match) {
    const emoji = match[1]
    const text = msg.slice(emoji.length).trim()
    return { emoji, text }
  }
  
  return { emoji: null, text: msg }
}

function formatReactionTooltip(r: Reaction, currentAgentId: string): string {
  if (!r.agent_ids || r.agent_ids.length === 0) return ''

  const names = r.agent_ids.map((id, index) => {
    if (id === currentAgentId) return 'You'
    return r.agent_names?.[index] || 'Someone'
  })

  // Sort so 'You' appears first
  const sortedNames = [...names].sort((a, b) => {
    if (a === 'You') return -1
    if (b === 'You') return 1
    return 0
  })

  if (sortedNames.length === 1) {
    return `${sortedNames[0]}`
  }
  if (sortedNames.length === 2) {
    return `${sortedNames[0]} and ${sortedNames[1]}`
  }
  if (sortedNames.length === 3) {
    return `${sortedNames[0]}, ${sortedNames[1]}, and ${sortedNames[2]}`
  }
  const remaining = sortedNames.length - 3
  return `${sortedNames.slice(0, 3).join(', ')}, and ${remaining} other${remaining > 1 ? 's' : ''}`
}

const KNOWN_MULTI_WORD_MENTIONS = [
  'Alex C',
  'Chris E',
  'Nancy G',
  'Rosario D',
  'John Paul',
  'Ric Becerra',
]

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// File extension matchers
const PDF_EXTENSIONS = /\.(pdf)(\?.*)?$/i
const DOC_EXTENSIONS = /\.(docx|doc|xlsx|xls|csv|txt)(\?.*)?$/i
const IMAGE_EXTENSIONS = /\.(png|jpg|jpeg|gif|webp|svg|bmp)(\?.*)?$/i

function isImageUrl(url: string): boolean {
  if (IMAGE_EXTENSIONS.test(url)) return true
  try {
    const parsed = new URL(url)
    return (
      /\.(png|jpg|jpeg|gif|webp|svg|bmp)$/i.test(parsed.pathname) ||
      parsed.hostname.includes('giphy.com') ||
      parsed.hostname.includes('tenor.com') ||
      (parsed.hostname.includes('supabase.co') && parsed.pathname.includes('/chat-media/'))
    )
  } catch {
    return false
  }
}

function getGifEmbedUrl(url: string): string | null {
  try {
    const parsed = new URL(url)
    if (parsed.hostname.includes('giphy.com')) {
      const match = parsed.pathname.match(/gifs\/(?:.*-)?([a-zA-Z0-9]+)$/)
      if (match && match[1]) {
        return `https://giphy.com/embed/${match[1]}`
      }
    }
    if (parsed.hostname.includes('tenor.com')) {
      const match = parsed.pathname.match(/view\/(?:.*-)?([0-9]+)$/)
      if (match && match[1]) {
        return `https://tenor.com/embed/${match[1]}`
      }
    }
    return url
  } catch {
    return null
  }
}

function isPdfUrl(url: string): boolean {
  if (PDF_EXTENSIONS.test(url)) return true
  try {
    const parsed = new URL(url)
    return parsed.pathname.endsWith('.pdf') || parsed.searchParams.get('type') === 'pdf'
  } catch {
    return false
  }
}

function isDocUrl(url: string): boolean {
  return DOC_EXTENSIONS.test(url)
}

function getFileNameFromUrl(url: string): string {
  try {
    const parsed = new URL(url)
    const name = parsed.pathname.split('/').pop() || 'document'
    return decodeURIComponent(name)
  } catch {
    return 'document'
  }
}

/**
 * Interactive Fullscreen Image Lightbox Modal (Zoom, Pan, Download, Copy)
 */
function ImageLightboxModal({
  url,
  onClose,
}: {
  url: string
  onClose: () => void
}) {
  const [zoom, setZoom] = useState(1)
  const [copied, setCopied] = useState(false)

  const handleDownload = () => {
    const a = document.createElement('a')
    a.href = url
    a.download = getFileNameFromUrl(url)
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    a.click()
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-150 select-none"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="relative max-w-5xl w-full max-h-[92vh] flex flex-col items-center justify-center">
        {/* Floating Toolbar */}
        <div className="absolute top-2 right-2 flex items-center gap-1.5 bg-slate-900/80 backdrop-blur-md border border-slate-700/60 rounded-full px-3 py-1.5 z-10 shadow-xl text-white">
          <button
            onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
            className="p-1 hover:bg-slate-700 rounded-full transition-colors cursor-pointer"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-xs font-mono font-medium px-1">{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
            className="p-1 hover:bg-slate-700 rounded-full transition-colors cursor-pointer"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <div className="w-[1px] h-4 bg-slate-700 mx-1" />
          <button
            onClick={handleCopy}
            className="p-1 hover:bg-slate-700 rounded-full transition-colors cursor-pointer"
            title="Copy Image Link"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          </button>
          <button
            onClick={handleDownload}
            className="p-1 hover:bg-slate-700 rounded-full transition-colors cursor-pointer"
            title="Download Image"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="p-1 hover:bg-red-500/80 rounded-full transition-colors ml-1 cursor-pointer"
            title="Close (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Image Display */}
        <div className="overflow-auto max-h-[84vh] max-w-full flex items-center justify-center p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt="Expanded view"
            style={{ transform: `scale(${zoom})`, transition: 'transform 0.15s ease-out' }}
            className="rounded-lg max-h-[80vh] max-w-full object-contain shadow-2xl"
          />
        </div>
      </div>
    </div>
  )
}

/**
 * Interactive In-App PDF Viewer Modal
 */
function PdfViewerModal({
  url,
  fileName,
  onClose,
}: {
  url: string
  fileName: string
  onClose: () => void
}) {
  const handleDownload = () => {
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    a.click()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-2 sm:p-4 animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
        {/* PDF Header */}
        <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="bg-red-500/20 text-red-400 border border-red-500/30 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded">
              PDF Document
            </span>
            <span className="font-semibold text-sm text-slate-100 truncate">{fileName}</span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-sky-400" />
              <span>Download</span>
            </button>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              title="Open in new tab"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              title="Close viewer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Embedded PDF iframe */}
        <div className="flex-1 w-full bg-slate-100 dark:bg-slate-950 relative">
          <iframe
            src={`${url}#toolbar=1`}
            className="w-full h-full border-none"
            title={fileName}
          />
        </div>
      </div>
    </div>
  )
}

/**
 * Modern In-Chat PDF Card Component
 */
function PdfCard({
  url,
  onOpenModal,
}: {
  url: string
  onOpenModal: (url: string, name: string) => void
}) {
  const fileName = getFileNameFromUrl(url)

  return (
    <div className="my-1.5 max-w-sm bg-white dark:bg-slate-900 border border-red-200/80 dark:border-red-950/60 rounded-xl p-2.5 shadow-xs hover:shadow-md transition-all group/pdf">
      <div className="flex items-center gap-3">
        {/* Red PDF Icon */}
        <div className="w-10 h-10 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-100 dark:border-red-900/50 flex items-center justify-center shrink-0 text-red-600">
          <FileText className="w-5 h-5" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-extrabold uppercase tracking-wider text-red-600 bg-red-50 dark:bg-red-950/80 px-1.5 py-0.2 rounded">
              PDF
            </span>
            <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{fileName}</p>
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">Click to preview document in-app</p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => onOpenModal(url, fileName)}
          className="flex-1 flex items-center justify-center gap-1 px-2.5 py-1 bg-red-50 hover:bg-red-100 dark:bg-red-950/60 dark:hover:bg-red-900/60 text-red-700 dark:text-red-300 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
        >
          <Eye className="w-3.5 h-3.5" />
          <span>Preview PDF</span>
        </button>

        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          download={fileName}
          className="flex items-center justify-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
          title="Download PDF"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Download</span>
        </a>
      </div>
    </div>
  )
}

/**
 * Modern In-Chat General Document Card Component
 */
function DocCard({ url }: { url: string }) {
  const fileName = getFileNameFromUrl(url)
  const isExcel = /\.xlsx?$/i.test(fileName) || /\.csv$/i.test(fileName)
  const isWord = /\.docx?$/i.test(fileName)

  const iconColor = isExcel ? 'text-emerald-600 bg-emerald-50 border-emerald-100' : isWord ? 'text-blue-600 bg-blue-50 border-blue-100' : 'text-slate-600 bg-slate-50 border-slate-200'
  const badgeColor = isExcel ? 'text-emerald-700 bg-emerald-50' : isWord ? 'text-blue-700 bg-blue-50' : 'text-slate-700 bg-slate-100'

  return (
    <div className="my-1.5 max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 shadow-xs hover:shadow-md transition-all">
      <div className="flex items-center gap-3">
        <div className={cn("w-10 h-10 rounded-lg border flex items-center justify-center shrink-0", iconColor)}>
          <File className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className={cn("text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded", badgeColor)}>
              {isExcel ? 'Spreadsheet' : isWord ? 'Document' : 'File'}
            </span>
            <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{fileName}</p>
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">Attachment file</p>
        </div>

        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          download={fileName}
          className="p-2 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer shrink-0"
          title="Download file"
        >
          <Download className="w-4 h-4" />
        </a>
      </div>
    </div>
  )
}

/**
 * Renders message content with inline markdown, mentions, media, PDFs, and docs.
 */
function renderContent(
  content: string,
  currentAgent: Agent | null | undefined,
  onOpenImage: (url: string) => void,
  onOpenPdf: (url: string, name: string) => void
): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  
  // Multi-word mention targets or single word mention targets
  const multiWordPattern = KNOWN_MULTI_WORD_MENTIONS.map((m) => escapeRegExp(m)).join('|')
  const mentionPattern = `@(?:${multiWordPattern}|[a-zA-Z0-9_]+)`

  const regex = new RegExp(
    `(\\*\\*(.+?)\\*\\*|\\*(.+?)\\*|\`([^\`]+)\`|(${mentionPattern})|https?:\\/\\/[^\\s<]+|data:image\\/[^\\s<]+)`,
    'g'
  )

  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(content)) !== null) {
    // Push plain text before match
    if (match.index > lastIndex) {
      parts.push(content.slice(lastIndex, match.index))
    }

    const full = match[0]

    if (match[2]) {
      // **bold**
      parts.push(
        <strong key={match.index} className="font-bold">
          {match[2]}
        </strong>
      )
    } else if (match[3]) {
      // *italic*
      parts.push(
        <em key={match.index} className="italic">
          {match[3]}
        </em>
      )
    } else if (match[4]) {
      // `code`
      parts.push(
        <code
          key={match.index}
          className="bg-slate-100 text-pink-600 px-1 py-0.5 rounded text-[13px] font-mono dark:bg-slate-800 dark:text-pink-400"
        >
          {match[4]}
        </code>
      )
    } else if (full.startsWith('@')) {
      // @Mention
      const targetName = full.slice(1).toLowerCase()
      const isTargetingMe = currentAgent && (
        currentAgent.name.toLowerCase() === targetName ||
        targetName === 'everyone' ||
        targetName === 'all' ||
        currentAgent.team?.toLowerCase() === targetName ||
        currentAgent.office?.toLowerCase() === targetName ||
        (currentAgent.role === 'admin' && targetName === 'admin')
      )

      parts.push(
        <span
          key={match.index}
          className={cn(
            'font-semibold rounded px-1.5 py-0.5 inline-flex items-center gap-0.5 transition-colors select-none text-[13px]',
            isTargetingMe
              ? 'bg-blue-600 text-white font-bold shadow-xs'
              : 'bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50'
          )}
        >
          {full}
        </span>
      )
    } else if (full.startsWith('http') || full.startsWith('data:image/')) {
      // 1. PDF detection
      if (isPdfUrl(full)) {
        parts.push(
          <PdfCard key={match.index} url={full} onOpenModal={onOpenPdf} />
        )
      } else if (isDocUrl(full)) {
        // 2. Document attachment (Word / Excel / CSV)
        parts.push(
          <DocCard key={match.index} url={full} />
        )
      } else {
        // 3. Check for GIF platform view pages
        const embedUrl = full.startsWith('http') ? getGifEmbedUrl(full) : null
        if (embedUrl && embedUrl !== full) {
          parts.push(
            <div key={match.index} className="my-1">
              <iframe
                src={embedUrl}
                className="rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm"
                width="280"
                height="220"
                frameBorder="0"
                allowFullScreen
                loading="lazy"
                title="GIF"
                style={{ maxWidth: '100%' }}
              />
            </div>
          )
        } else if (isImageUrl(full) || (embedUrl === full)) {
          // 4. Image with Interactive Lightbox on Click
          parts.push(
            <div
              key={match.index}
              onClick={() => onOpenImage(full)}
              className="inline-block my-1 group/img relative cursor-pointer"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={full}
                alt="Shared image"
                className="rounded-xl max-w-xs sm:max-w-sm max-h-64 object-contain border border-slate-200 dark:border-slate-700 shadow-xs hover:shadow-md transition-all group-hover/img:scale-[1.01]"
                loading="lazy"
                onError={(e) => {
                  const target = e.currentTarget
                  const parent = target.parentElement
                  if (parent) {
                    parent.className = 'text-blue-600 hover:text-blue-700 hover:underline inline-flex items-center gap-0.5 dark:text-blue-400'
                    target.replaceWith(document.createTextNode(full.length > 50 ? full.slice(0, 50) + '…' : full))
                  }
                }}
              />
              <div className="absolute top-2 right-2 opacity-0 group-hover/img:opacity-100 bg-black/60 text-white p-1 rounded-md backdrop-blur-xs transition-opacity shadow-sm">
                <Maximize2 className="w-3.5 h-3.5" />
              </div>
            </div>
          )
        } else {
          // 5. Regular URL
          parts.push(
            <a
              key={match.index}
              href={full}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-700 hover:underline inline-flex items-center gap-0.5 dark:text-blue-400"
            >
              {full.length > 50 ? full.slice(0, 50) + '…' : full}
              <ExternalLink className="w-3 h-3 inline shrink-0" />
            </a>
          )
        }
      }
    }

    lastIndex = match.index + full.length
  }

  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex))
  }

  return parts.length > 0 ? parts : [content]
}

export default function MessageBubble({
  message,
  currentAgentId,
  isGrouped,
  isGroupChannel,
  isDirectDM,
  conversationMembers = [],
  otherMemberLastReadAt,
  onReply,
  onEdit,
  onDelete,
  onPin,
  onReact,
  hasPermission,
}: MessageBubbleProps) {
  const [showActions, setShowActions] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [activeLightboxUrl, setActiveLightboxUrl] = useState<string | null>(null)
  const [activePdf, setActivePdf] = useState<{ url: string; name: string } | null>(null)

  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(message.content)
  const [isSaving, setIsSaving] = useState(false)

  const handleOpenPdf = useCallback((url: string, name: string) => {
    setActivePdf({ url, name })
  }, [])

  const handleOpenImage = useCallback((url: string) => {
    setActiveLightboxUrl(url)
  }, [])

  const handleSaveEdit = async () => {
    if (editValue.trim() === '' || editValue === message.content) {
      setIsEditing(false)
      setEditValue(message.content)
      return
    }
    setIsSaving(true)
    try {
      await onEdit(message.id, editValue)
      setIsEditing(false)
    } finally {
      setIsSaving(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSaveEdit()
    } else if (e.key === 'Escape') {
      setIsEditing(false)
      setEditValue(message.content)
    }
  }

  let chat: any = null
  try {
    chat = useChat()
  } catch {
    // optional fallback outside provider
  }
  const currentAgent = chat?.currentAgent ?? null

  const senderName = message.sender?.name ?? 'Unknown'
  const senderId = message.sender_id || message.sender?.id

  const isSelf = Boolean(
    currentAgent && (senderId === currentAgent.id || senderName.toLowerCase() === currentAgent.name.toLowerCase())
  )
  const isOwn = message.sender_id === currentAgentId || isSelf || Boolean(currentAgent && message.sender_id === currentAgent.id)
  const isAdmin = hasPermission('admin')

  const senderPresence = senderId && chat?.getLivePresence
    ? chat.getLivePresence(senderId, message.sender)
    : (message.sender?.presence || 'offline')

  const senderStatusMsg = isSelf
    ? currentAgent?.status_message
    : (senderId && chat?.getLiveStatusMessage ? chat.getLiveStatusMessage(senderId, message.sender?.status_message) : message.sender?.status_message)

  const statusInfo = useMemo(() => parseStatusMessage(senderStatusMsg ?? null), [senderStatusMsg])

  // Check if current user is @mentioned in this message
  const isMentioned = useMemo(() => {
    if (!currentAgent || !message.content || message.is_deleted || message.is_system) return false
    const name = currentAgent.name.toLowerCase()
    const team = currentAgent.team?.toLowerCase()
    const office = currentAgent.office?.toLowerCase()
    const role = currentAgent.role?.toLowerCase()
    const text = message.content.toLowerCase()

    const directMention = new RegExp(`@${escapeRegExp(name)}\\b`, 'i').test(text)
    const everyoneMention = /@(everyone|all)\b/i.test(text)
    const teamMention = team ? new RegExp(`@${escapeRegExp(team)}\\b`, 'i').test(text) : false
    const officeMention = office ? new RegExp(`@${escapeRegExp(office)}\\b`, 'i').test(text) : false
    const roleMention = role === 'admin' ? /@admin\b/i.test(text) : false

    return directMention || everyoneMention || teamMention || officeMention || roleMention
  }, [currentAgent, message.content, message.is_deleted, message.is_system])

  // Calculate seen count for this message
  const seenByCount = useMemo(() => {
    if (!conversationMembers || conversationMembers.length === 0) return 0
    const msgTime = new Date(message.created_at).getTime()
    return conversationMembers.filter(
      (m) =>
        m.agent_id !== message.sender_id &&
        m.last_read_at &&
        new Date(m.last_read_at).getTime() >= msgTime - 1000
    ).length
  }, [conversationMembers, message.sender_id, message.created_at])

  // System messages
  if (message.is_system) {
    return (
      <div className="flex justify-center py-1">
        <span className="text-xs text-slate-400 italic bg-slate-50 px-3 py-1 rounded-full">
          {message.content}
        </span>
      </div>
    )
  }

  // Deleted messages
  if (message.is_deleted) {
    return (
      <div id={`message-${message.id}`} className={cn('flex gap-3 px-4 py-1', isGrouped ? 'pl-[60px]' : '')}>
        {!isGrouped && <div className="w-8 h-8 shrink-0" />}
        <p className="text-sm text-slate-400 italic">This message was deleted</p>
      </div>
    )
  }

  return (
    <div
      id={`message-${message.id}`}
      className={cn(
        'group relative flex flex-col transition-all duration-150',
        isGrouped ? 'py-0.5' : 'py-1.5',
        isMentioned
          ? 'bg-amber-500/[0.08] dark:bg-amber-500/[0.14] border-l-[3px] border-amber-400 dark:border-amber-500 hover:bg-amber-500/[0.12] -ml-2 pl-2'
          : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
      )}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => { if (showEmojiPicker) return; setShowActions(false); setShowEmojiPicker(false); }}
      onClick={() => {
        if (window.matchMedia('(hover: none)').matches) {
          setShowActions(prev => !prev)
        }
      }}
    >
      {isGrouped && (
        <div className="absolute left-[16px] top-1/2 -translate-y-1/2 w-[36px] text-right opacity-0 group-hover:opacity-100 transition-opacity duration-150 select-none pointer-events-none z-10">
          <span className="text-[9px] font-bold text-slate-400 font-mono">
            {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
          </span>
        </div>
      )}
      {/* Reply Context Header */}
      {message.parent_preview && (
        <div className="flex items-center gap-2 pl-[60px] pr-4 mb-0.5 text-[11px] text-slate-400 select-none relative">
          {/* Curved line connector */}
          <div className="absolute left-[28px] top-[7px] w-[24px] h-[14px] border-l-2 border-t-2 border-slate-200 rounded-tl-md" />
          
          {/* Mini Avatar for reply parent */}
          <div className="w-4 h-4 rounded-full bg-slate-200/80 flex items-center justify-center text-[9px] font-bold text-slate-600 shrink-0 select-none">
            {message.parent_preview.sender_name.charAt(0).toUpperCase()}
          </div>
          
          <span className="font-semibold text-slate-600 hover:text-blue-500 hover:underline cursor-pointer transition-colors">
            {message.parent_preview.sender_name}
          </span>
          <span className="truncate max-w-[400px] text-slate-400 italic">
            "{message.parent_preview.content}"
          </span>
        </div>
      )}

      {/* Message Row */}
      <div className={cn('flex items-start gap-3 px-4 py-1 transition-colors', isGrouped ? 'pl-[60px]' : 'mt-1')}>
        {/* Avatar with presence status dot overlay */}
        {!isGrouped && (
          <UserHoverCard agent={message.sender ? { ...message.sender, id: senderId, presence: senderPresence, status_message: senderStatusMsg } : { id: senderId, name: senderName, presence: senderPresence, status_message: senderStatusMsg }} side="top" className="shrink-0 self-start">
            <div className="relative shrink-0 mt-0.5 w-8 h-8 cursor-pointer group/avatar">
              <Avatar name={senderName} url={message.sender?.avatar_url} className="w-8 h-8 text-xs select-none transition-transform group-hover/avatar:scale-105 shadow-xs" fallbackClassName="w-8 h-8 text-xs select-none transition-transform group-hover/avatar:scale-105 shadow-xs" />
              <UserPresenceBadge
                status={senderPresence as any}
                size="sm"
                className="absolute -bottom-0.5 -right-0.5 ring-[2px] ring-white dark:ring-slate-900"
              />
            </div>
          </UserHoverCard>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Name + status + timestamp (only on first in group) */}
          {!isGrouped && (
            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
              <UserHoverCard agent={message.sender || { name: senderName }} side="top">
                <span className={cn(
                  "text-[13px] font-bold hover:underline cursor-pointer transition-colors",
                  isOwn ? "text-blue-700 dark:text-blue-400" : "text-slate-800 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400"
                )}>
                  {senderName}
                </span>
              </UserHoverCard>


              
              {/* Premium Inline Status Badge */}
              {statusInfo.text && (
                <span 
                  className="inline-flex items-center gap-1 text-[11px] font-normal text-slate-500 bg-slate-50 border border-slate-200/50 px-1.5 py-0.5 rounded-full select-none max-w-[200px]"
                  title={message.sender?.status_message || ''}
                >
                  {statusInfo.emoji && <span className="text-xs shrink-0 select-none">{statusInfo.emoji}</span>}
                  <span className="truncate">{statusInfo.text}</span>
                </span>
              )}
              
              <div className="flex items-center gap-1.5 mt-0.5 opacity-80 group-hover/msg:opacity-100 transition-opacity">
                <span className="text-[10px] font-medium text-slate-500 select-none">
                  {formatTime(message.created_at)}
                </span>

                {/* Live Seen / Delivered Indicator & Hover Card */}
                {!isDirectDM ? (
                  // Channels & Group Chats: Seen by N (or Eye badge for others)
                  <SeenByHoverCard
                    message={message}
                    conversationMembers={conversationMembers}
                    isOwn={isOwn}
                    isGroupChannel={true}
                    isDirectDM={false}
                  >
                    {isOwn ? (
                      <button
                        type="button"
                        className={cn(
                          "inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full cursor-pointer transition-all select-none shadow-2xs",
                          seenByCount > 0
                            ? "text-blue-600 dark:text-blue-400 bg-blue-50/90 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 border border-blue-200/60 dark:border-blue-800/60"
                            : "text-slate-400 dark:text-slate-500 bg-slate-100/70 dark:bg-slate-800/70 hover:bg-slate-200/70 dark:hover:bg-slate-700/70 border border-slate-200/50 dark:border-slate-700/50"
                        )}
                        title={seenByCount > 0 ? `Seen by ${seenByCount} members (Hover to view)` : "Delivered to channel (Unread)"}
                      >
                        <CheckCheck className={cn("w-3.5 h-3.5", seenByCount > 0 ? "text-blue-500" : "text-slate-400")} />
                        <span>{seenByCount > 0 ? `Seen by ${seenByCount}` : "Delivered"}</span>
                      </button>
                    ) : (
                      seenByCount > 0 ? (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-400 hover:text-blue-600 dark:text-slate-500 dark:hover:text-blue-400 bg-transparent hover:bg-blue-50/80 dark:hover:bg-blue-950/60 border border-transparent hover:border-blue-200/50 px-1.5 py-0.5 rounded-full cursor-pointer transition-all select-none"
                          title={`Seen by ${seenByCount} members (Hover to view)`}
                        >
                          <Eye className="w-3 h-3" />
                          <span>{seenByCount}</span>
                        </button>
                      ) : null
                    )}
                  </SeenByHoverCard>
                ) : (
                  // Direct DM (1-on-1): Seen / Delivered
                  isOwn && (
                    <SeenByHoverCard
                      message={message}
                      conversationMembers={conversationMembers}
                      isOwn={true}
                      isGroupChannel={false}
                      isDirectDM={true}
                      otherMemberLastReadAt={otherMemberLastReadAt}
                    >
                      {(() => {
                        const msgTime = new Date(message.created_at).getTime()
                        const isSeen = Boolean(
                          otherMemberLastReadAt &&
                          new Date(otherMemberLastReadAt).getTime() >= msgTime - 1000
                        )
                        return (
                          <button
                            type="button"
                            className={cn(
                              "inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full cursor-pointer transition-all select-none shadow-2xs",
                              isSeen
                                ? "text-blue-600 dark:text-blue-400 bg-blue-50/90 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 border border-blue-200/60 dark:border-blue-800/60"
                                : "text-slate-400 dark:text-slate-500 bg-slate-100/70 dark:bg-slate-800/70 hover:bg-slate-200/70 dark:hover:bg-slate-700/70 border border-slate-200/50 dark:border-slate-700/50"
                            )}
                            title={isSeen ? "Delivered & Seen (Hover to view)" : "Delivered to chat (Unread by recipient)"}
                          >
                            <CheckCheck className={cn("w-3.5 h-3.5", isSeen ? "text-blue-500" : "text-slate-400")} />
                            <span className="hidden sm:inline">{isSeen ? "Seen" : "Delivered"}</span>
                          </button>
                        )
                      })()}
                    </SeenByHoverCard>
                  )
                )}
              </div>

              {message.is_pinned && (
                <Pin className="w-3 h-3 text-amber-500 shrink-0" />
              )}
              {message.priority === 'important' && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
                  <AlertTriangle className="w-3 h-3" />
                  Important
                </span>
              )}
              {message.priority === 'urgent' && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-700 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-full">
                  <AlertCircle className="w-3 h-3" />
                  Urgent
                </span>
              )}
            </div>
          )}

          {/* Message text */}
          <div className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed break-words whitespace-pre-wrap">
            {isEditing ? (
              <div className="flex flex-col gap-2 mt-1">
                <textarea
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="w-full text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  rows={3}
                  autoFocus
                  disabled={isSaving}
                />
                <div className="flex items-center gap-2 text-[11px]">
                  <button
                    onClick={handleSaveEdit}
                    disabled={isSaving}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.25 rounded transition-colors font-medium disabled:opacity-50 cursor-pointer"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setIsEditing(false)
                      setEditValue(message.content)
                    }}
                    disabled={isSaving}
                    className="text-slate-500 hover:text-slate-700 font-medium px-2 py-1.25 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <span className="text-slate-400 ml-auto hidden sm:inline">escape to cancel • enter to save</span>
                </div>
              </div>
            ) : (
              <>
                {renderContent(message.content, currentAgent, handleOpenImage, handleOpenPdf)}
                {message.is_edited && (
                  <span className="text-[11px] text-slate-400 ml-1">(edited)</span>
                )}
              </>
            )}
          </div>

          {/* Reactions */}
          {message.reactions && message.reactions.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              {message.reactions.map((r) => {
                const isReactedByMe = r.agent_ids.includes(currentAgentId)
                const reactorNames = formatReactionTooltip(r, currentAgentId)
                return (
                  <div key={r.emoji} className="relative group/reaction inline-flex">
                    <button
                      onClick={() => {
                        if (['🎉', '🚀', '🥳', '🏆', '💯', '✨'].includes(r.emoji)) {
                          triggerConfetti()
                        }
                        onReact(message.id, r.emoji)
                      }}
                      title={`${r.emoji} ${reactorNames}`}
                      className={cn(
                        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs border transition-all duration-150 cursor-pointer select-none active:scale-90',
                        isReactedByMe
                          ? 'bg-blue-50 border-blue-200 text-blue-700 font-medium hover:bg-blue-100 hover:border-blue-300 shadow-2xs'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 hover:border-slate-300'
                      )}
                    >
                      <span className="text-[13px] leading-none">{r.emoji}</span>
                      <span className="font-semibold text-[11px]">{r.count}</span>
                    </button>

                    {/* Floating Tooltip Showing Who Reacted on Hover */}
                    <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover/reaction:flex flex-col items-center z-30">
                      <div className="bg-slate-900/95 text-white text-[11px] font-medium px-2.5 py-1 rounded-md shadow-xl whitespace-nowrap backdrop-blur-sm border border-slate-800 flex items-center gap-1.5">
                        <span className="text-xs">{r.emoji}</span>
                        <span>{reactorNames}</span>
                      </div>
                      <div className="w-2 h-1 bg-slate-900 rotate-45 -mt-0.5" />
                    </div>
                  </div>
                )
              })}

              {/* Quick Add Reaction Button on Reaction Pill Row */}
              <div className="relative inline-flex">
                <button
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className="inline-flex items-center justify-center w-6 h-6 rounded-full border border-dashed border-slate-300 text-slate-400 hover:text-slate-600 hover:border-slate-400 hover:bg-slate-50 transition-all text-xs cursor-pointer select-none"
                  title="Add reaction"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modern Hover Action Bar with 1-Click Quick Emojis */}
      {showActions && (
        <div className="absolute right-2 sm:right-4 -top-3.5 flex items-center gap-0.5 bg-white/95 dark:bg-slate-800/95 backdrop-blur-md border border-slate-200/90 dark:border-slate-700/80 rounded-full shadow-md px-1.5 py-0.5 z-20 animate-in fade-in zoom-in-95 duration-100 max-w-[calc(100vw-32px)] overflow-x-auto">
          {/* 1-Click Popular Quick Reactions */}
          <div className="flex items-center gap-0.5 mr-1 pr-1 border-r border-slate-200 dark:border-slate-700">
            {['👍', '❤️', '😂', '🔥', '🎉', '🚀'].map((emoji) => (
              <button
                key={emoji}
                onClick={() => {
                  if (['🎉', '🚀', '🥳', '🏆', '💯', '✨'].includes(emoji)) {
                    triggerConfetti()
                  }
                  onReact(message.id, emoji)
                }}
                className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 hover:scale-125 transition-all text-sm cursor-pointer select-none"
                title={`React with ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>

          <div className="relative">
            <button
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="w-6 h-6 flex items-center justify-center rounded-full text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors cursor-pointer"
              title="More reactions..."
            >
              <Smile className="w-3.5 h-3.5" />
            </button>
            {showEmojiPicker && (
              <EmojiReactionPicker
                align="right"
                placement="bottom"
                onSelect={(emoji) => {
                  if (['🎉', '🚀', '🥳', '🏆', '💯', '✨'].includes(emoji)) {
                    triggerConfetti()
                  }
                  onReact(message.id, emoji)
                  setShowEmojiPicker(false)
                  setShowActions(false)
                }}
                onClose={() => { setShowEmojiPicker(false); setShowActions(false); }}
              />
            )}
          </div>

          <button
            onClick={() => onReply(message.id)}
            className="w-6 h-6 flex items-center justify-center rounded-full text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors cursor-pointer"
            title="Reply"
          >
            <Reply className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => onPin(message.id)}
            className="w-6 h-6 flex items-center justify-center rounded-full text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors cursor-pointer"
            title={message.is_pinned ? 'Unpin' : 'Pin'}
          >
            <Pin className="w-3.5 h-3.5" />
          </button>

          {isOwn && (
            <button
              onClick={() => {
                setIsEditing(true)
                setEditValue(message.content)
              }}
              className="w-6 h-6 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              title="Edit"
            >
              <Pencil className="w-3 h-3" />
            </button>
          )}

          {(isOwn || isAdmin) && (
            <button
              onClick={() => onDelete(message.id)}
              className="w-6 h-6 flex items-center justify-center rounded-full text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
              title="Delete"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      )}

      {/* Fullscreen Image Lightbox Modal */}
      {activeLightboxUrl && (
        <ImageLightboxModal
          url={activeLightboxUrl}
          onClose={() => setActiveLightboxUrl(null)}
        />
      )}

      {/* In-App PDF Document Viewer Modal */}
      {activePdf && (
        <PdfViewerModal
          url={activePdf.url}
          fileName={activePdf.name}
          onClose={() => setActivePdf(null)}
        />
      )}
    </div>
  )
}
