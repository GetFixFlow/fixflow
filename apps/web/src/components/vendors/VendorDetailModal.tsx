import { useState } from 'react'
import { Mail, Pencil, Phone, Trash2, UserPlus } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { useAddVendorContact, useRemoveVendorContact, useVendor } from '@/hooks/useVendors'
import { phoneHref, websiteHref } from '@/lib/vendorLinks'
import type { Vendor } from '@/types'

interface VendorDetailModalProps {
  vendor: Vendor
  canManage: boolean
  onEdit: () => void
  onClose: () => void
}

const linkClass = 'text-brand-600 hover:underline dark:text-brand-400'

function Line({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-2 text-sm">
      <dt className="text-gray-500">{label}</dt>
      <dd className="col-span-2 whitespace-pre-line text-gray-900 dark:text-gray-100">{children}</dd>
    </div>
  )
}

function AddContact({ vendorId }: { vendorId: number }) {
  const add = useAddVendorContact(vendorId)
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    add.mutate(
      { name: name.trim(), role: role.trim() || null, phone: phone.trim() || null, email: email.trim() || null },
      { onSuccess: () => { setName(''); setRole(''); setPhone(''); setEmail('') } },
    )
  }

  return (
    <form onSubmit={submit} className="mt-3 space-y-2 rounded-md border border-dashed border-gray-300 p-3 dark:border-gray-600" noValidate>
      <div className="grid grid-cols-2 gap-2">
        <Input id="contact-name" label="Name *" value={name} onChange={(e) => setName(e.target.value)} />
        <Input id="contact-role" label="Role" value={role} onChange={(e) => setRole(e.target.value)} />
        <Input id="contact-phone" label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <Input id="contact-email" label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <Button type="submit" size="sm" disabled={!name.trim() || add.isPending}>
        <UserPlus className="h-4 w-4" />{add.isPending ? 'Adding…' : 'Add contact'}
      </Button>
    </form>
  )
}

/** A vendor's details and the people to call there. Managers add and remove contacts and open the edit form. */
export function VendorDetailModal({ vendor, canManage, onEdit, onClose }: VendorDetailModalProps) {
  const { data } = useVendor(vendor.id)
  const remove = useRemoveVendorContact(vendor.id)
  const current = data ?? vendor
  const contacts = current.contacts ?? []
  const site = websiteHref(current.website)
  const call = phoneHref(current.phone)

  return (
    <Modal open onClose={onClose} title={current.name} description={current.category ?? undefined} className="max-h-[90vh] max-w-xl overflow-y-auto">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={current.active ? 'success' : 'secondary'}>{current.active ? 'Active' : 'Not in use'}</Badge>
          <span className="text-sm text-gray-500">
            {current.work_orders_count === 1 ? '1 work order' : `${current.work_orders_count} work orders`}
          </span>
        </div>

        <dl className="space-y-2">
          {current.phone && <Line label="Phone">{call ? <a className={linkClass} href={call}>{current.phone}</a> : current.phone}</Line>}
          {current.email && <Line label="Email"><a className={linkClass} href={`mailto:${current.email}`}>{current.email}</a></Line>}
          {current.website && (
            <Line label="Website">
              {site ? <a className={linkClass} href={site} target="_blank" rel="noopener noreferrer">{current.website}</a> : current.website}
            </Line>
          )}
          {current.address && <Line label="Address">{current.address}</Line>}
          {current.notes && <Line label="Notes">{current.notes}</Line>}
        </dl>

        <section aria-label="Contacts">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">People to call</h3>
          {contacts.length === 0 ? (
            <p className="mt-1 text-sm text-gray-500">No contacts yet.</p>
          ) : (
            <ul className="mt-2 divide-y divide-gray-200 rounded-md border border-gray-200 dark:divide-gray-700 dark:border-gray-700">
              {contacts.map((contact) => {
                const contactCall = phoneHref(contact.phone)
                return (
                  <li key={contact.id} className="flex items-start justify-between gap-2 p-3 text-sm">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-gray-100">
                        {contact.name}{contact.role && <span className="font-normal text-gray-500"> · {contact.role}</span>}
                      </p>
                      <div className="mt-0.5 flex flex-wrap gap-x-4 gap-y-1 text-gray-600 dark:text-gray-300">
                        {contact.phone && (
                          <span className="inline-flex items-center gap-1"><Phone className="h-3.5 w-3.5" />
                            {contactCall ? <a className={linkClass} href={contactCall}>{contact.phone}</a> : contact.phone}
                          </span>
                        )}
                        {contact.email && (
                          <span className="inline-flex items-center gap-1"><Mail className="h-3.5 w-3.5" />
                            <a className={linkClass} href={`mailto:${contact.email}`}>{contact.email}</a>
                          </span>
                        )}
                      </div>
                    </div>
                    {canManage && (
                      <Button
                        variant="ghost" size="icon" aria-label={`Remove ${contact.name}`}
                        disabled={remove.isPending}
                        onClick={() => { if (confirm(`Remove ${contact.name} from ${current.name}?`)) remove.mutate(contact.id) }}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
          {canManage && <AddContact vendorId={vendor.id} />}
        </section>

        <div className="flex gap-2 pt-1">
          <Button variant="outline" onClick={onClose} className="flex-1">Close</Button>
          {canManage && <Button onClick={onEdit} className="flex-1"><Pencil className="h-4 w-4" />Edit details</Button>}
        </div>
      </div>
    </Modal>
  )
}
