import { Link } from 'react-router-dom'
import { CheckCircle2, Circle, Sparkles, Upload, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { useDismissGettingStarted, useGettingStarted, useLoadSampleData, useRemoveSampleData, useSampleData } from '@/hooks/useSampleData'

/**
 * The first three things to do, ticked off from what is really in the install, for the administrator.
 * Also says when what is on screen is sample data, and offers to remove it.
 */
export function GettingStarted() {
  const { data: guide } = useGettingStarted()
  const { data: sample } = useSampleData()
  const dismiss = useDismissGettingStarted()
  const load = useLoadSampleData()
  const remove = useRemoveSampleData()

  const removeSample = () => {
    if (!confirm('Remove the sample data? Anything you added yourself stays. Sample items you have since built on are kept.')) return
    remove.mutate()
  }

  return (
    <>
      {sample?.loaded && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/10 dark:text-amber-300">
          <span className="flex items-center gap-2"><Sparkles className="h-4 w-4" /> Some of what you see is sample data (named &ldquo;Sample: …&rdquo;), there to look around in.</span>
          <Button size="sm" variant="outline" onClick={removeSample} disabled={remove.isPending}>
            {remove.isPending ? 'Removing…' : 'Remove sample data'}
          </Button>
        </div>
      )}

      {guide && !guide.dismissed && !guide.all_done && (
        <Card>
          <CardContent className="space-y-4 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-gray-900 dark:text-gray-100">Getting started</h2>
                <p className="text-sm text-gray-500">Three things to do first. They tick off as you do them.</p>
              </div>
              <button onClick={() => dismiss.mutate()} aria-label="Put this away" className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700">
                <X className="h-4 w-4" />
              </button>
            </div>

            <ol className="space-y-3">
              {guide.steps.map((step) => (
                <li key={step.key} className="flex items-start gap-3">
                  {step.done ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-500" aria-label="Done" /> : <Circle className="mt-0.5 h-5 w-5 shrink-0 text-gray-300" aria-label="Not done yet" />}
                  <div className="flex-1">
                    <p className={step.done ? 'text-sm font-medium text-gray-400 line-through' : 'text-sm font-medium text-gray-900 dark:text-gray-100'}>{step.title}</p>
                    <p className="text-xs text-gray-500">{step.description}</p>
                  </div>
                  {!step.done && <Link to={step.path}><Button size="sm" variant="outline">Go</Button></Link>}
                </li>
              ))}
            </ol>

            <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3 dark:border-gray-700">
              <Link to="/import"><Button size="sm" variant="ghost"><Upload className="h-4 w-4" /> Import from a spreadsheet</Button></Link>
              {!sample?.loaded && (
                <Button size="sm" variant="ghost" onClick={() => load.mutate()} disabled={load.isPending}>
                  <Sparkles className="h-4 w-4" /> {load.isPending ? 'Adding…' : 'Add sample data to look around'}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </>
  )
}
