import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { toast } from 'sonner'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { backupsApi } from '@/api/backups'
import type { DataUsage } from '@/api/dataUsage'
import { triggerDownload } from '@/services/exportService'
import { formatBytes } from '@/lib/retentionText'
import { formatDateTime } from '@/lib/localeFormat'

/** The nightly database backups: what is kept, whether one is missing, a way to take a copy, and how to restore one. */
export function BackupsCard({ backups }: { backups: DataUsage['backups'] | undefined }) {
  const [downloading, setDownloading] = useState<string | null>(null)
  const { data: list, isError, isLoading } = useQuery({ queryKey: ['backups'], queryFn: backupsApi.list })

  const download = async (name: string) => {
    setDownloading(name)
    try {
      const file = await backupsApi.download(name)
      triggerDownload(file.blob, file.filename)
    } catch (error) {
      toast.error(isAxiosError(error) && error.response?.status === 404
        ? 'That backup is no longer in the file storage.'
        : 'The backup could not be downloaded. Check that the file storage is running.')
    } finally {
      setDownloading(null)
    }
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100">Database backups</h3>
        {backups && (backups.runs ? (
          <p className="text-sm text-gray-600 dark:text-gray-400">
            A copy of the database, and of any photos and documents people uploaded since the last one, is made every night at {backups.at}.
            The database copies are kept for {backups.keep_days} days in the <span className="font-mono">{backups.bucket}</span> bucket
            {backups.separate ? ' of the separate backup storage' : ' of the file storage'}. A backup that fails is tried again every {backups.retry_minutes} minutes,
            {' '}{backups.tries} tries in all; if the last one fails, every administrator is emailed (when email is set up) and a line is
            written to the audit log.
          </p>
        ) : (
          <p className="text-sm text-gray-600 dark:text-gray-400">
            This server does not make backups: only a production server does (nightly at {backups.at}, kept {backups.keep_days} days).
          </p>
        ))}

        {list?.overdue && (
          <p role="alert" className="rounded-md bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
            {list.backups.length === 0
              ? 'There is no backup, and one should have been made by now.'
              : `The newest backup is from ${formatDateTime(list.backups[0].created_at)}, and a new one should have been made since.`}
            {' '}Check that the background worker is running (Settings, System Health) and that the file storage is up.
          </p>
        )}

        {isLoading && <p className="text-sm text-gray-500">Loading the backups…</p>}
        {(isError || list?.error) && (
          <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
            {list?.error ?? 'The list of backups could not be loaded. Try again in a moment.'}
          </p>
        )}
        {list && !list.error && list.backups.length === 0 && !list.overdue && (
          <p className="text-sm text-gray-500">No backups yet.{backups?.runs ? ` The first one is made tonight at ${backups.at}.` : ''}</p>
        )}
        {list && list.backups.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-gray-500">
                <th className="py-1 font-medium">Made</th>
                <th className="py-1 text-right font-medium">Size</th>
                <th className="py-1"><span className="sr-only">Download</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {list.backups.map((backup) => (
                <tr key={backup.name}>
                  <td className="py-2 text-gray-700 dark:text-gray-300">
                    {formatDateTime(backup.created_at)}
                    <span className="ml-2 font-mono text-xs text-gray-400">{backup.name}</span>
                  </td>
                  <td className="py-2 text-right font-mono text-xs text-gray-700 dark:text-gray-300">{formatBytes(backup.bytes)}</td>
                  <td className="py-2 text-right">
                    <Button size="sm" variant="outline" disabled={downloading !== null} onClick={() => download(backup.name)}
                      aria-label={`Download the backup of ${formatDateTime(backup.created_at)}`}>
                      <Download className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                      {downloading === backup.name ? 'Downloading…' : 'Download'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <p className="text-xs text-gray-500">
          A backup holds everything in the database, password hashes included: keep a downloaded copy somewhere safe. Every download is written to the
          audit log. Uploaded files are copied under <span className="font-mono">files/</span> in the same bucket and are never deleted from
          the copy, because an older backup may still point at them.
        </p>
        {backups?.runs && !backups.separate && (
          <p role="note" className="rounded-md bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
            These backups are on the same storage server and disk as the data they protect, so they do not survive losing the server. Set{' '}
            <span className="font-mono">BACKUP_S3_ACCESS_KEY</span>, <span className="font-mono">BACKUP_S3_SECRET_KEY</span> and{' '}
            <span className="font-mono">BACKUP_S3_ENDPOINT</span> to keep them somewhere else (see &quot;Backups and restoring&quot; in the documentation), or copy the
            <span className="font-mono"> s3_data</span> volume off the server yourself.
          </p>
        )}
        <details className="text-xs text-gray-600 dark:text-gray-400">
          <summary className="cursor-pointer font-medium">How to restore a backup</summary>
          <div className="mt-2 space-y-1">
            <p>Restoring is done on the server, with the web and worker processes stopped, into an empty database:</p>
            <p className="font-mono">rails "fixflow:restore[latest]"</p>
            <p>This also copies the uploaded files back (add <span className="font-mono">FILES=no</span> to skip that).</p>
            <p>
              Use a name from the list instead of <span className="font-mono">latest</span>, or the path of a downloaded file. To replace a database that
              already has data, add <span className="font-mono">REPLACE=yes</span>: everything in it is deleted, but only if the restore succeeds. Afterwards run{' '}
              <span className="font-mono">rails db:migrate</span> if it asks you to. See &quot;Backups and restoring&quot; in the documentation.
            </p>
          </div>
        </details>
      </CardContent>
    </Card>
  )
}
