import { useState } from 'react'
import { formatDistanceToNow, format } from 'date-fns'
import { Plus, MoreVertical, UserCheck, UserX, KeyRound, Pencil } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { Badge } from '@/components/ui/Badge'
import { InviteUserModal } from '@/components/settings/InviteUserModal'
import { EditUserModal } from '@/components/settings/EditUserModal'
import { useAuthStore } from '@/stores/authStore'
import {
  useUsers,
  useDeactivateUser,
  useReactivateUser,
  useResetUserPassword,
  useChangeUserRole,
} from '@/hooks/useUsers'
import type { User, Role } from '@/types'
import { cn } from '@/lib/utils'

const ROLE_STYLES: Record<string, string> = {
  admin: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  manager: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  technician: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  requester: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
}

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  invited: 'bg-amber-100 text-amber-700',
  deactivated: 'bg-gray-100 text-gray-500',
}

function getUserStatus(user: User & { active?: boolean; invitation_accepted_at?: string }): 'active' | 'invited' | 'deactivated' {
  if (user.active === false) return 'deactivated'
  if (!user.invitation_accepted_at) return 'invited'
  return 'active'
}

function NameAvatar({ name }: { name: string }) {
  const colors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500', 'bg-teal-500', 'bg-pink-500']
  let hash = 0
  for (const c of name) hash = c.charCodeAt(0) + ((hash << 5) - hash)
  const color = colors[Math.abs(hash) % colors.length]
  const initials = name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
  return (
    <div className={cn('h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0', color)}>
      {initials}
    </div>
  )
}

export function UsersPage() {
  const { user: currentUser } = useAuthStore()
  const { data: users = [], isLoading } = useUsers()
  const deactivate = useDeactivateUser()
  const reactivate = useReactivateUser()
  const resetPassword = useResetUserPassword()
  const changeRole = useChangeUserRole()

  const [showInvite, setShowInvite] = useState(false)
  const [editUser, setEditUser] = useState<User | null>(null)
  const [openMenuId, setOpenMenuId] = useState<number | null>(null)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [showBulkBar, setShowBulkBar] = useState(false)

  const isAdmin = currentUser?.role === 'admin'
  const isManager = currentUser?.role === 'admin' || currentUser?.role === 'manager'

  const allIds = users.map((u) => u.id)
  const allSelected = selectedIds.length === allIds.length && allIds.length > 0

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
      setShowBulkBar(next.length > 0)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds([])
      setShowBulkBar(false)
    } else {
      setSelectedIds(allIds)
      setShowBulkBar(true)
    }
  }

  const clearSelection = () => {
    setSelectedIds([])
    setShowBulkBar(false)
  }

  if (!isManager) {
    return (
      <div className="space-y-6">
        <PageHeader title="Team Members" description="Manage your organization's users" />
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-gray-500">You don't have permission to manage users.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Modals */}
      <InviteUserModal open={showInvite} onClose={() => setShowInvite(false)} />
      {editUser && (
        <EditUserModal open={!!editUser} onClose={() => setEditUser(null)} user={editUser} />
      )}

      <PageHeader
        title="Team Members"
        description={`${users.length} member${users.length !== 1 ? 's' : ''} in your organization`}
        actions={
          isAdmin ? (
            <Button onClick={() => setShowInvite(true)}>
              <Plus className="h-4 w-4 mr-1.5" /> Invite User
            </Button>
          ) : undefined
        }
      />

      {/* Bulk action bar */}
      {showBulkBar && (
        <div className="flex items-center gap-3 px-4 py-3 bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-700 rounded-lg">
          <span className="text-sm font-medium text-brand-700 dark:text-brand-300">
            {selectedIds.length} selected
          </span>
          <div className="flex items-center gap-2 ml-auto">
            {isAdmin && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const role = prompt('New role (admin/manager/technician/requester):') as Role
                    if (role) selectedIds.forEach((id) => changeRole.mutate({ id, role }))
                    clearSelection()
                  }}
                >
                  Change Role
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-red-600 border-red-300 hover:bg-red-50"
                  onClick={() => {
                    if (confirm(`Deactivate ${selectedIds.length} users?`)) {
                      selectedIds.forEach((id) => deactivate.mutate(id))
                      clearSelection()
                    }
                  }}
                >
                  Deactivate
                </Button>
              </>
            )}
            <Button variant="ghost" size="sm" onClick={clearSelection}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                  <tr>
                    <th className="px-4 py-3 w-10">
                      <input
                        type="checkbox"
                        aria-label="Select all"
                        checked={allSelected}
                        onChange={toggleSelectAll}
                        className="rounded"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden lg:table-cell">Joined</th>
                    <th className="px-4 py-3 w-12" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {users.map((u) => {
                    const extUser = u as User & { active?: boolean; invitation_accepted_at?: string }
                    const status = getUserStatus(extUser)
                    const isDeactivated = status === 'deactivated'
                    return (
                      <tr
                        key={u.id}
                        className={cn(
                          'hover:bg-gray-50 dark:hover:bg-gray-800/50',
                          isDeactivated && 'opacity-50',
                        )}
                      >
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(u.id)}
                            onChange={() => toggleSelect(u.id)}
                            className="rounded"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            {u.avatar_url ? (
                              <img src={u.avatar_url} className="h-8 w-8 rounded-full object-cover" alt={u.full_name} />
                            ) : (
                              <NameAvatar name={u.full_name} />
                            )}
                            <span className="font-medium text-gray-900 dark:text-gray-100">{u.full_name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-500">{u.email}</td>
                        <td className="px-4 py-3">
                          <span className={cn(
                            'inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize',
                            ROLE_STYLES[u.role],
                          )}>
                            {u.role}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn(
                            'inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize',
                            STATUS_STYLES[status],
                          )}>
                            {status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-400 hidden lg:table-cell">
                          {format(new Date(u.created_at), 'MMM d, yyyy')}
                        </td>
                        <td className="px-4 py-3">
                          <div className="relative">
                            <button
                              onClick={() => setOpenMenuId(openMenuId === u.id ? null : u.id)}
                              className="rounded p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </button>
                            {openMenuId === u.id && (
                              <div className="absolute right-0 z-10 mt-1 w-44 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg py-1">
                                <button
                                  onClick={() => { setEditUser(u); setOpenMenuId(null) }}
                                  className="flex items-center gap-2 w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700"
                                >
                                  <Pencil className="h-3.5 w-3.5" /> Edit User
                                </button>
                                {isAdmin && (
                                  <button
                                    onClick={() => {
                                      resetPassword.mutate(u.id)
                                      setOpenMenuId(null)
                                    }}
                                    className="flex items-center gap-2 w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700"
                                  >
                                    <KeyRound className="h-3.5 w-3.5" /> Reset Password
                                  </button>
                                )}
                                {isAdmin && (
                                  isDeactivated ? (
                                    <button
                                      onClick={() => { reactivate.mutate(u.id); setOpenMenuId(null) }}
                                      className="flex items-center gap-2 w-full px-3 py-1.5 text-left text-sm text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"
                                    >
                                      <UserCheck className="h-3.5 w-3.5" /> Reactivate
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => { deactivate.mutate(u.id); setOpenMenuId(null) }}
                                      className="flex items-center gap-2 w-full px-3 py-1.5 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                                    >
                                      <UserX className="h-3.5 w-3.5" /> Deactivate
                                    </button>
                                  )
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
