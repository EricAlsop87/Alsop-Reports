'use client'

import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
  type KeyboardEvent,
  type ClipboardEvent,
  type FormEvent,
  type DragEvent,
} from 'react'
import {
  Send,
  X,
  ChevronDown,
  AlertTriangle,
  AlertCircle,
  Loader2,
  Smile,
  Paperclip,
  FileText,
  Image as ImageIcon,
  File as FileIcon,
  Plus,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import MentionAutocomplete from './MentionAutocomplete'
import GifPicker from './GifPicker'
import EmojiReactionPicker from './EmojiReactionPicker'
import type { Agent, Message } from './types'

interface MessageComposerProps {
  conversationId: string
  currentAgentId: string
  replyTo: Message | null
  members: Agent[]
  onSend: (content: string, parentId?: string, priority?: string) => Promise<void>
  onCancelReply: () => void
  hasPermission: (key: string) => boolean
  isCompact?: boolean
}

interface UploadedAttachment {
  id: string
  url: string
  name: string
  type: string
  size?: number
  ext: string
}

type PriorityLevel = 'normal' | 'important' | 'urgent'

const PRIORITY_OPTIONS: { value: PriorityLevel; label: string; icon: React.ReactNode; color: string }[] = [
  { value: 'normal', label: 'Normal', icon: null, color: 'text-slate-600' },
  {
    value: 'important',
    label: 'Important',
    icon: <AlertTriangle className="w-3 h-3 text-amber-500" />,
    color: 'text-amber-600',
  },
  {
    value: 'urgent',
    label: 'Urgent',
    icon: <AlertCircle className="w-3 h-3 text-red-500" />,
    color: 'text-red-600',
  },
]

function formatFileSize(bytes?: number): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Extracts plain text and image URLs from contentEditable DOM tree
 */
function extractContentFromDom(node: Node, isRoot = true): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent || ''
  }
  if (node.nodeType === Node.ELEMENT_NODE) {
    const el = node as HTMLElement
    if (el.tagName === 'IMG') {
      const src = el.getAttribute('src') || ''
      return src ? ` ${src} ` : ''
    }
    if (el.tagName === 'BR') {
      return '\n'
    }
    let text = ''
    for (const child of Array.from(el.childNodes)) {
      text += extractContentFromDom(child, false)
    }
    if ((el.tagName === 'DIV' || el.tagName === 'P') && !isRoot) {
      return (text.trim() ? '\n' : '') + text
    }
    return text
  }
  return ''
}

export default function MessageComposer({
  conversationId,
  currentAgentId,
  replyTo,
  members,
  onSend,
  onCancelReply,
  hasPermission,
  isCompact = false,
}: MessageComposerProps) {
  const [content, setContent] = useState('')
  const [attachments, setAttachments] = useState<UploadedAttachment[]>([])
  const [priority, setPriority] = useState<PriorityLevel>('normal')
  const [isSending, setIsSending] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isDraggingOver, setIsDraggingOver] = useState(false)
  const [showPriority, setShowPriority] = useState(false)
  const [showGifPicker, setShowGifPicker] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [mentionPosition, setMentionPosition] = useState({ top: 0, left: 0 })
  const editorRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Focus editor on mount and conversation change
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.focus()
    }
  }, [conversationId, replyTo])

  // Sync content state when DOM changes
  const updateContentFromDom = useCallback(() => {
    if (!editorRef.current) return
    const text = extractContentFromDom(editorRef.current).trim()
    setContent(text)

    // Check for @ mention trigger
    const selection = window.getSelection()
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0)
      const textBefore = range.startContainer.textContent?.slice(0, range.startOffset) || ''
      const atMatch = textBefore.match(/@(\w*)$/)

      if (atMatch) {
        setMentionQuery(atMatch[1])
        const rect = range.getBoundingClientRect()
        setMentionPosition({
          top: rect.top,
          left: rect.left,
        })
      } else {
        setMentionQuery(null)
      }
    } else {
      setMentionQuery(null)
    }
  }, [])

  // File upload processor
  const handleUploadFiles = useCallback(async (files: FileList | File[]) => {
    if (!files || files.length === 0) return
    setIsUploading(true)

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const formData = new FormData()
        formData.append('file', file)

        const res = await fetch('/api/chat/upload', {
          method: 'POST',
          body: formData,
        })

        if (res.ok) {
          const data = await res.json()
          if (data.url) {
            setAttachments(prev => [
              ...prev,
              {
                id: `${Date.now()}-${Math.random()}`,
                url: data.url,
                name: data.originalName || file.name,
                type: data.fileType || file.type,
                size: data.fileSize || file.size,
                ext: data.ext || file.name.split('.').pop() || 'bin'
              }
            ])
          }
        }
      }
    } catch (err) {
      console.error('Failed to upload files:', err)
    } finally {
      setIsUploading(false)
      setTimeout(() => {
        editorRef.current?.focus()
      }, 0)
    }
  }, [])

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleUploadFiles(e.target.files)
      e.target.value = ''
    }
  }

  const handleRemoveAttachment = (id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id))
  }

  const handleSend = useCallback(async () => {
    const text = content.trim()
    const attachmentLinks = attachments.map(a => a.url).join('\n')
    const fullMessage = [text, attachmentLinks].filter(Boolean).join('\n')

    if (!fullMessage.trim() || isSending || isUploading) return

    // Clear input immediately for better UX
    if (editorRef.current) {
      editorRef.current.innerHTML = ''
    }
    setContent('')
    setAttachments([])
    setPriority('normal')
    setShowGifPicker(false)
    
    // Ensure focus remains
    editorRef.current?.focus()

    setIsSending(true)
    try {
      await onSend(fullMessage, replyTo?.id, priority)
    } finally {
      setIsSending(false)
    }
  }, [content, attachments, isSending, isUploading, onSend, replyTo, priority])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      // Don't intercept Enter if mention picker is open
      if (mentionQuery !== null) return

      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend, mentionQuery]
  )

  /**
   * Handle pasting images/GIFs from Windows "Win + ." or clipboard
   */
  const handlePaste = useCallback(
    async (e: ClipboardEvent<HTMLDivElement>) => {
      const clipboardData = e.clipboardData
      if (!clipboardData) return

      // 1. Check for image files/blobs from Windows GIF picker or clipboard
      let imageFile: File | null = null

      if (clipboardData.files && clipboardData.files.length > 0) {
        for (let i = 0; i < clipboardData.files.length; i++) {
          const file = clipboardData.files[i]
          if (file.type.startsWith('image/')) {
            imageFile = file
            break
          }
        }
      }

      if (!imageFile && clipboardData.items) {
        for (let i = 0; i < clipboardData.items.length; i++) {
          const item = clipboardData.items[i]
          if (item.type.startsWith('image/')) {
            imageFile = item.getAsFile()
            if (imageFile) break
          }
        }
      }

      if (imageFile) {
        e.preventDefault()
        setIsUploading(true)
        try {
          const formData = new FormData()
          formData.append('file', imageFile)

          const res = await fetch('/api/chat/upload', {
            method: 'POST',
            body: formData,
          })

          if (res.ok) {
            const data = await res.json()
            if (data.url && editorRef.current) {
              // Insert image element into contentEditable
              const img = document.createElement('img')
              img.src = data.url
              img.className = 'max-h-28 rounded-lg my-1 inline-block'
              img.alt = 'GIF'

              const selection = window.getSelection()
              if (selection && selection.rangeCount > 0) {
                const range = selection.getRangeAt(0)
                range.deleteContents()
                range.insertNode(img)
                range.collapse(false)
              } else {
                editorRef.current.appendChild(img)
              }
              updateContentFromDom()
            }
          }
        } catch (err) {
          console.error('Failed to upload pasted image:', err)
        } finally {
          setIsUploading(false)
          setTimeout(() => {
            if (editorRef.current) {
              editorRef.current.focus()
            }
          }, 0)
        }
        return
      }

      // 2. Check for HTML snippet with <img src="...">
      const html = clipboardData.getData('text/html')
      if (html) {
        const imgMatch = html.match(/<img[^>]+src=["']([^"']+)["']/i)
        if (imgMatch && imgMatch[1] && (imgMatch[1].startsWith('http') || imgMatch[1].startsWith('data:image/'))) {
          e.preventDefault()
          const src = imgMatch[1]
          if (editorRef.current) {
            const img = document.createElement('img')
            img.src = src
            img.className = 'max-h-28 rounded-lg my-1 inline-block'
            img.alt = 'GIF'

            const selection = window.getSelection()
            if (selection && selection.rangeCount > 0) {
              const range = selection.getRangeAt(0)
              range.deleteContents()
              range.insertNode(img)
              range.collapse(false)
            } else {
              editorRef.current.appendChild(img)
            }
            updateContentFromDom()
          }
          return
        }
      }
    },
    [updateContentFromDom]
  )

  const handleInput = useCallback(
    (e: FormEvent<HTMLDivElement>) => {
      // Auto-replace emoji shortcodes like :fire:, :rocket:, <3
      const sel = window.getSelection()
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0)
        const node = range.startContainer
        if (node && node.nodeType === Node.TEXT_NODE && node.textContent) {
          let text = node.textContent
          let replaced = false
          const shortcodeMap: Record<string, string> = {
            ':fire:': '🔥',
            ':lit:': '🔥',
            ':rocket:': '🚀',
            ':tada:': '🎉',
            ':party:': '🎉',
            ':celebrate:': '🥳',
            ':heart:': '❤️',
            '<3': '❤️',
            ':thumbsup:': '👍',
            ':+1:': '👍',
            ':thumbsdown:': '👎',
            ':-1:': '👎',
            ':smile:': '😄',
            ':joy:': '😂',
            ':lol:': '😂',
            ':sunglasses:': '😎',
            ':cool:': '😎',
            ':100:': '💯',
            ':clap:': '👏',
            ':pray:': '🙏',
            ':star:': '⭐',
            ':eyes:': '👀',
            ':wink:': '😉',
            ':mindblown:': '🤯',
            ':muscle:': '💪',
            ':target:': '🎯',
            ':trophy:': '🏆',
            ':sparkles:': '✨',
            ':check:': '✅',
          }
          for (const [code, emoji] of Object.entries(shortcodeMap)) {
            if (text.includes(code)) {
              text = text.replace(code, emoji)
              replaced = true
            }
          }
          if (replaced) {
            node.textContent = text
            range.setStartAfter(node)
            range.setEndAfter(node)
            sel.removeAllRanges()
            sel.addRange(range)
          }
        }
      }
      updateContentFromDom()
    },
    [updateContentFromDom]
  )

  const handleMentionSelect = useCallback(
    (mention: string) => {
      if (!editorRef.current) return
      const selection = window.getSelection()
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0)
        const node = range.startContainer
        if (node.nodeType === Node.TEXT_NODE) {
          const text = node.textContent || ''
          const beforeAt = text.slice(0, range.startOffset).replace(/@\w*$/, mention + ' ')
          const afterAt = text.slice(range.startOffset)
          node.textContent = beforeAt + afterAt
          range.setStart(node, beforeAt.length)
          range.setEnd(node, beforeAt.length)
        }
      }
      setMentionQuery(null)
      updateContentFromDom()
    },
    [updateContentFromDom]
  )

  const handleGifSelect = useCallback((gifUrl: string) => {
    if (!editorRef.current) return
    const img = document.createElement('img')
    img.src = gifUrl
    img.className = 'max-h-28 rounded-lg my-1 inline-block'
    img.alt = 'GIF'
    editorRef.current.appendChild(img)
    updateContentFromDom()
    setShowGifPicker(false)
    editorRef.current.focus()
  }, [updateContentFromDom])

  const handleEmojiSelect = useCallback((emoji: string) => {
    if (!editorRef.current) return
    editorRef.current.focus()

    const sel = window.getSelection()
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0)
      range.deleteContents()
      const textNode = document.createTextNode(emoji)
      range.insertNode(textNode)
      range.setStartAfter(textNode)
      range.setEndAfter(textNode)
      sel.removeAllRanges()
      sel.addRange(range)
    } else {
      editorRef.current.appendChild(document.createTextNode(emoji))
    }
    updateContentFromDom()
    setShowEmojiPicker(false)
  }, [updateContentFromDom])

  const canSendUrgent = hasPermission('send_urgent_messages')
  const isEmpty = !content.trim() && attachments.length === 0

  return (
    <div
      className={cn(
        "relative border-t border-slate-100 bg-white transition-all",
        isDraggingOver && "ring-2 ring-blue-400 bg-blue-50/20",
        isCompact ? "shrink-0" : ""
      )}
      onDragOver={(e) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDraggingOver(true)
      }}
      onDragLeave={(e) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDraggingOver(false)
      }}
      onDrop={(e) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDraggingOver(false)
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          handleUploadFiles(e.dataTransfer.files)
        }
      }}
    >
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
        onChange={handleFileInputChange}
        className="hidden"
      />

      {/* Drag & Drop Visual Overlay */}
      {isDraggingOver && (
        <div className="absolute inset-0 z-40 flex items-center justify-center rounded-lg border-2 border-dashed border-blue-500 bg-blue-50/95 backdrop-blur-xs transition-all pointer-events-none">
          <div className="flex flex-col items-center gap-1.5 text-blue-700 font-semibold text-xs sm:text-sm animate-pulse">
            <Paperclip className="h-6 w-6 text-blue-600 animate-bounce" />
            <span>Drop files or PDFs to attach</span>
          </div>
        </div>
      )}

      {/* Reply preview */}
      {replyTo && (
        <div className={cn("pb-0", isCompact ? "px-2 pt-2" : "px-4 pt-3")}>
          <div className="flex items-center gap-2 bg-blue-50/80 border border-blue-100 rounded-lg px-3 py-2">
            <div className="w-0.5 h-5 bg-blue-400 rounded-full shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold text-blue-600">
                Replying to {replyTo.sender?.name ?? 'Unknown'}
              </p>
              <p className="text-xs text-slate-500 truncate">{replyTo.content.replace(/<[^>]*>?/gm, '')}</p>
            </div>
            <button
              onClick={onCancelReply}
              className="w-5 h-5 flex items-center justify-center rounded text-slate-400 hover:text-slate-600 hover:bg-white/50 transition-colors shrink-0 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Input area */}
      <div className={cn(isCompact ? "p-2" : "p-3 sm:p-4")}>
        {/* Uploading indicator */}
        {isUploading && (
          <div className="mb-2 flex items-center gap-2 rounded-lg bg-blue-50 border border-blue-100 px-3 py-1.5 text-xs text-blue-700 font-medium animate-pulse">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" />
            <span>Uploading file / media attachment...</span>
          </div>
        )}

        {/* Pending Attachments Tray */}
        {attachments.length > 0 && (
          <div className="mb-2.5 flex flex-wrap gap-2">
            {attachments.map((att) => {
              const isPdf = att.ext.toLowerCase() === 'pdf'
              const isImg = att.type.startsWith('image/')
              return (
                <div
                  key={att.id}
                  className="group relative flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 hover:bg-white p-1.5 pr-2.5 shadow-xs transition-all"
                >
                  {isImg ? (
                    <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded bg-slate-200 border border-slate-300">
                      <img src={att.url} alt={att.name} className="h-full w-full object-cover" />
                    </div>
                  ) : isPdf ? (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-red-100 text-red-600">
                      <FileText className="h-4 w-4" />
                    </div>
                  ) : (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-blue-100 text-blue-600">
                      <FileIcon className="h-4 w-4" />
                    </div>
                  )}
                  <div className="max-w-[130px] sm:max-w-[190px] min-w-0">
                    <p className="truncate text-xs font-semibold text-slate-800">{att.name}</p>
                    {att.size && (
                      <p className="text-[10px] text-slate-400 font-medium">{formatFileSize(att.size)}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveAttachment(att.id)}
                    className="ml-1 rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors cursor-pointer"
                    title="Remove attachment"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )
            })}
          </div>
        )}

        <div className={cn(
          "flex bg-slate-50 border border-slate-200 rounded-xl p-2 focus-within:ring-2 focus-within:ring-blue-100 focus-within:border-blue-400 transition-all",
          isCompact ? "flex-col gap-2" : "flex-row items-end gap-2 sm:gap-3"
        )}>
          {/* ContentEditable Rich Text Input with 16px mobile font to prevent auto-zoom */}
          <div className="relative flex-1 min-w-0 min-h-[40px] max-h-[160px] overflow-y-auto">
            {isEmpty && (
              <div className="pointer-events-none absolute left-2 sm:left-3 top-2 text-base sm:text-sm text-slate-400 select-none">
                Write a message...
              </div>
            )}
            <div
              ref={editorRef}
              contentEditable={!isUploading}
              role="textbox"
              aria-multiline="true"
              onInput={handleInput}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              className="w-full bg-transparent border-none px-2 sm:px-3 py-2 text-base sm:text-sm text-slate-900 focus:outline-none min-h-[40px] whitespace-pre-wrap break-words leading-normal cursor-text"
              style={{ minHeight: '40px' }}
            />
          </div>

          {/* Action buttons toolbar */}
          <div className={cn("flex items-center gap-1 shrink-0", isCompact ? "justify-between w-full pb-0" : "pb-1")}>
            <div className="flex items-center gap-1">
              {/* Attachment Button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className={cn(
                  'flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-semibold text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-all cursor-pointer',
                  isUploading && 'opacity-50 cursor-not-allowed'
                )}
                title="Attach Images, PDFs, or Documents"
              >
                <Paperclip className="w-4 h-4 text-slate-500" />
                <span className={cn("hidden", isCompact ? "" : "sm:inline")}>Attach</span>
              </button>

              {/* Built-in Emoji Picker Button */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className={cn(
                    'flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer select-none',
                    showEmojiPicker
                      ? 'bg-amber-100 text-amber-800 shadow-xs ring-1 ring-amber-300'
                      : 'text-slate-500 hover:text-amber-600 hover:bg-amber-50'
                  )}
                  title="Insert an Emoji"
                >
                  <Smile className="w-4 h-4 text-amber-500" />
                  <span className={cn("hidden", isCompact ? "" : "sm:inline")}>Emoji</span>
                </button>

                {/* Emoji Picker Dropdown */}
                {showEmojiPicker && (
                  <div className="absolute z-50 bottom-full left-0 mb-2">
                    <EmojiReactionPicker
                      align="left"
                      placement="top"
                      defaultExpanded={true}
                      onSelect={handleEmojiSelect}
                      onClose={() => setShowEmojiPicker(false)}
                    />
                  </div>
                )}
              </div>

              {/* Built-in GIF Picker Button */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowGifPicker(!showGifPicker)}
                  className={cn(
                    'flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer',
                    showGifPicker
                      ? 'bg-pink-100 text-pink-700 shadow-xs ring-1 ring-pink-200'
                      : 'text-slate-500 hover:text-pink-600 hover:bg-pink-50'
                  )}
                  title="Insert a GIF"
                >
                  <span className="flex h-4 w-4 items-center justify-center rounded bg-pink-500 text-white text-[9px] font-extrabold">
                    G
                  </span>
                  <span className={cn("hidden", isCompact ? "" : "sm:inline")}>GIF</span>
                </button>

                {/* GIF Picker Dropdown */}
                {showGifPicker && (
                  <div className="absolute z-50 bottom-full left-0 mb-2">
                    <GifPicker
                      onSelect={handleGifSelect}
                      onClose={() => setShowGifPicker(false)}
                    />
                  </div>
                )}
              </div>

              {/* Priority selector */}
              {canSendUrgent && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowPriority(!showPriority)}
                    className={cn(
                      'flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer',
                      priority === 'normal'
                        ? 'text-slate-400 hover:text-slate-600 hover:bg-slate-200/50'
                        : priority === 'important'
                          ? 'text-amber-600 bg-amber-50'
                          : 'text-red-600 bg-red-50'
                    )}
                    title="Message Priority"
                  >
                    {PRIORITY_OPTIONS.find((p) => p.value === priority)?.icon}
                    {priority !== 'normal' && (
                      <span className="capitalize">{priority}</span>
                    )}
                    <ChevronDown className="w-3 h-3" />
                  </button>

                  {showPriority && (
                    <div className="absolute bottom-full left-0 mb-1 bg-white border border-slate-200 rounded-lg shadow-lg py-1 min-w-[130px] z-20">
                      {PRIORITY_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => {
                            setPriority(opt.value)
                            setShowPriority(false)
                          }}
                          className={cn(
                            'w-full flex items-center gap-2 px-3 py-1.5 text-sm transition-colors hover:bg-slate-50 cursor-pointer',
                            priority === opt.value ? 'font-medium' : '',
                            opt.color
                          )}
                        >
                          {opt.icon}
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Send button */}
            <button
              onClick={handleSend}
              disabled={isEmpty || isSending || isUploading}
              className={cn(
                'rounded-lg px-3 h-9 flex items-center justify-center gap-1.5 text-sm font-semibold transition-all shrink-0 cursor-pointer',
                isCompact ? "flex-1 max-w-[100px]" : "sm:px-4 sm:h-10 sm:gap-2",
                !isEmpty && !isSending && !isUploading
                  ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs active:scale-[0.97]'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              )}
            >
              {isSending ? (
                <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
              ) : (
                <Send className="w-4 h-4 sm:w-5 sm:h-5" />
              )}
              <span className={cn(isCompact ? "" : "hidden sm:inline")}>Send</span>
            </button>
          </div>
        </div>

        {/* Footer hints */}
        <div className={cn("flex justify-between items-start mt-2 px-1", isCompact ? "flex-col gap-1" : "flex-row items-center")}>
          <p className="text-[11px] font-medium text-slate-400">
            <kbd className="font-mono bg-slate-100 border border-slate-200 rounded px-1">
              Enter
            </kbd>{' '}
            to send ·{' '}
            <kbd className="font-mono bg-slate-100 border border-slate-200 rounded px-1">
              Shift+Enter
            </kbd>{' '}
            for newline
          </p>
          {!isCompact && (
            <p className="text-[11px] text-slate-400 hidden sm:block">
              <span className="text-slate-300">**bold**</span>{' '}
              <span className="text-slate-300">*italic*</span>{' '}
              <span className="text-slate-300">`code`</span>
            </p>
          )}
        </div>
      </div>

      {/* Mention autocomplete */}
      {mentionQuery !== null && (
        <MentionAutocomplete
          query={mentionQuery}
          members={members}
          position={mentionPosition}
          onSelect={handleMentionSelect}
          onClose={() => setMentionQuery(null)}
          hasPermission={hasPermission}
        />
      )}
    </div>
  )
}
