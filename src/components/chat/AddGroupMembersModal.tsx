'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { X, Search, UserPlus, Check, Loader2, ShieldAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabaseClient'
import { addMembers } from '@/lib/chat/conversations'
import UserPresenceBadge from './UserPresenceBadge'
import type { Conversation, Agent } from './types'

interface AddGroupMembersModalProps {
  isOpen: boolean
  onClose: () => void
  conversation: Conversation
  currentAgent: Agent
  existingMembers?: Agent[]
  onMembersAdded: () => void
}

const AVATAR_COLORS = [
  'bg-blue-500',
  'bg-emerald-500',
  'bg-violet-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-cyan-500',
  'bg-indigo-500',
  'bg-teal-500',
]

function getAvatarColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

export default function AddGroupMembersModal({
  isOpen,
  onClose,
  conversation,
  currentAgent,
  existingMembers = [],
  onMembersAdded,
}: AddGroupMembersModalProps) {
  const [allAgents, setAllAgents] = useState<Agent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Enforce creator restriction for group DMs
  const isCreator = useMemo(() => {
    return conversation.created_by === currentAgent.id
  }, [conversation, currentAgent])

  const canAdd = useMemo(() => {
    if (conversation.type === 'group_dm') {
      return isCreator
    }
    return (
      isCreator ||
      currentAgent.role === 'admin' ||
      currentAgent.team === 'Managers'
    )
  }, [conversation, currentAgent, isCreator])

  // Fetch all active agents
  const fetchAvailableAgents = useCallback(async () => {
    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from('agents')
        .select('*')
        .eq('active', true)
        .order('name', { ascending: true })

      if (error) throw error

      if (data) {
        setAllAgents(data as Agent[])
      }
    } catch (err: any) {
      console.error('[AddGroupMembersModal] Failed to fetch agents:', err)
      setErrorMsg('Failed to load agents list')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isOpen) {
      fetchAvailableAgents()
      setSelectedIds(new Set())
      setSearch('')
      setErrorMsg(null)
    }
  }, [isOpen, fetchAvailableAgents])

  if (!isOpen) return null

  // Filter out agents already in the group
  const existingMemberIds = new Set(existingMembers.map((m) => m.id))
  const unjoinedAgents = allAgents.filter(
    (a) =>
      !existingMemberIds.has(a.id) &&
      a.report_visible !== false &&
      a.team !== 'System' &&
      a.name?.toLowerCase() !== 'other'
  )

  const filteredAgents = unjoinedAgents.filter((a) =>
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    (a.team && a.team.toLowerCase().includes(search.toLowerCase())) ||
    (a.office && a.office.toLowerCase().includes(search.toLowerCase()))
  )

  const toggleAgent = (agentId: string) => {
    if (!canAdd) return
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(agentId)) {
        next.delete(agentId)
      } else {
        next.add(agentId)
      }
      return next
    })
  }

  const handleSubmit = async () => {
    if (!canAdd || selectedIds.size === 0) return
    setIsSubmitting(true)
    setErrorMsg(null)
    try {
      await addMembers(conversation.id, Array.from(selectedIds))
      onMembersAdded()
      onClose()
    } catch (err: any) {
      console.error('[AddGroupMembersModal] Failed to add members:', err)
      setErrorMsg(err.message || 'Failed to add members to group')
    } finally {
      setIsSubmitting(false)
    }
  }

  const groupDisplayName = conversation.name || 'Group Chat'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div
        className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[85vh] overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-800 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 leading-tight">
                Add People to Group
              </h2>
              <p className="text-xs text-slate-400 truncate max-w-[240px]">
                {groupDisplayName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {/* Permission restriction banner */}
          {!canAdd && (
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0 text-amber-600" />
              <span>
                Only the <strong>group creator</strong> can add more people to this group.
              </span>
            </div>
          )}

          {canAdd && (
            <>
              {/* Search bar */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by name, team, or office..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              {/* Error feedback */}
              {errorMsg && (
                <div className="p-2.5 rounded-lg bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 text-xs border border-red-200 dark:border-red-800">
                  {errorMsg}
                </div>
              )}

              {/* Agent Roster List */}
              {isLoading ? (
                <div className="py-10 flex justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                </div>
              ) : filteredAgents.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  {unjoinedAgents.length === 0
                    ? 'All active agents are already members of this group!'
                    : 'No matching agents found.'}
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-64 overflow-y-auto pr-1">
                  {filteredAgents.map((agent) => {
                    const isSelected = selectedIds.has(agent.id)

                    return (
                      <div
                        key={agent.id}
                        onClick={() => toggleAgent(agent.id)}
                        className={cn(
                          'py-2.5 px-2.5 flex items-center justify-between rounded-xl cursor-pointer transition-colors my-0.5',
                          isSelected
                            ? 'bg-blue-50/80 dark:bg-blue-950/50 border border-blue-200/60 dark:border-blue-800/60'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                        )}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="relative shrink-0">
                            <div
                              className={cn(
                                'w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold select-none shadow-xs',
                                getAvatarColor(agent.name)
                              )}
                            >
                              {agent.name.charAt(0).toUpperCase()}
                            </div>
                            {agent.presence && (
                              <UserPresenceBadge
                                status={agent.presence as any}
                                size="sm"
                                className="absolute -bottom-0.5 -right-0.5 ring-2 ring-white dark:ring-slate-900"
                              />
                            )}
                          </div>

                          <div className="min-w-0">
                            <div className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                              {agent.name}
                            </div>
                            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-0.5">
                              {agent.team && (
                                <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 rounded font-medium text-slate-600 dark:text-slate-400">
                                  {agent.team}
                                </span>
                              )}
                              {agent.office && (
                                <span className="text-slate-400">• {agent.office}</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Checkbox */}
                        <div
                          className={cn(
                            'w-5 h-5 rounded-md border flex items-center justify-center transition-all shrink-0',
                            isSelected
                              ? 'bg-blue-600 border-blue-600 text-white shadow-2xs'
                              : 'border-slate-300 dark:border-slate-600 hover:border-slate-400'
                          )}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer actions */}
        {canAdd && (
          <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between shrink-0">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {selectedIds.size === 0
                ? 'Select people to add'
                : `${selectedIds.size} person${selectedIds.size !== 1 ? 's' : ''} selected`}
            </span>
            <button
              onClick={handleSubmit}
              disabled={selectedIds.size === 0 || isSubmitting}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition-all cursor-pointer"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <UserPlus className="w-4 h-4" />
              )}
              Add to Group
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
