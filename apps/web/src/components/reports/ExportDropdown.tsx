import { useState } from 'react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Download, FileText, FileSpreadsheet, Link2, Printer, ChevronDown, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { copyShareLink } from '@/services/exportService'

interface ExportDropdownProps {
  onExportCSV?: () => void
  onExportPDF?: () => void
  onExportExcel?: () => void
  isExporting?: boolean
  className?: string
}

export function ExportDropdown({ onExportCSV, onExportPDF, onExportExcel, isExporting, className }: ExportDropdownProps) {
  const [open, setOpen] = useState(false)

  const items = [
    { label: 'Export as CSV', icon: FileText, action: onExportCSV },
    { label: 'Export as Excel', icon: FileSpreadsheet, action: onExportExcel },
    { label: 'Export as PDF', icon: FileText, action: onExportPDF },
    { label: 'Copy Share Link', icon: Link2, action: () => copyShareLink() },
    { label: 'Print', icon: Printer, action: () => window.print() },
  ].filter((i) => i.action)

  return (
    <DropdownMenu.Root open={open} onOpenChange={setOpen}>
      <DropdownMenu.Trigger asChild>
        <Button variant="outline" disabled={isExporting} className={className}>
          {isExporting ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Download className="h-4 w-4 mr-1.5" />}
          Export <ChevronDown className="h-3.5 w-3.5 ml-1" />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className="z-50 min-w-40 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg p-1" sideOffset={4} align="end">
          {items.map((item) => (
            <DropdownMenu.Item key={item.label}
              className="flex items-center gap-2 px-3 py-2 text-sm rounded cursor-pointer text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none"
              onClick={() => { item.action?.(); setOpen(false) }}>
              <item.icon className="h-4 w-4 text-gray-400" />
              {item.label}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
