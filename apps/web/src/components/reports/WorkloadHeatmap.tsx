import { cn } from '@/lib/utils'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

interface WorkloadCell { technician: string; day: number; count: number }

export function WorkloadHeatmap({ data }: { data: WorkloadCell[] }) {
  const technicians = [...new Set(data.map((d) => d.technician))]
  const max = Math.max(...data.map((d) => d.count), 1)

  const intensity = (count: number) => Math.ceil((count / max) * 4)
  const bg = ['bg-gray-50 dark:bg-gray-800', 'bg-blue-100 dark:bg-blue-900/30', 'bg-blue-300 dark:bg-blue-700/50', 'bg-blue-500', 'bg-blue-700']

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr>
            <th className="text-left pr-3 py-1 text-gray-400 font-normal w-28">Technician</th>
            {DAYS.map((d) => <th key={d} className="text-center py-1 font-normal text-gray-400 w-10">{d}</th>)}
          </tr>
        </thead>
        <tbody>
          {technicians.map((tech) => (
            <tr key={tech}>
              <td className="pr-3 py-1 text-gray-700 dark:text-gray-300 font-medium truncate max-w-[112px]">{tech}</td>
              {DAYS.map((_, dayIdx) => {
                const cell = data.find((d) => d.technician === tech && d.day === dayIdx)
                const count = cell?.count ?? 0
                return (
                  <td key={dayIdx} className="py-1 text-center">
                    <div title={`${tech} • ${DAYS[dayIdx]}: ${count} WOs`}
                      className={cn('mx-auto h-8 w-8 rounded flex items-center justify-center text-[10px] font-medium text-white', bg[intensity(count)])}>
                      {count > 0 ? count : ''}
                    </div>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
