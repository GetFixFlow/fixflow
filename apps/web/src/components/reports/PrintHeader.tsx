export function PrintHeader({ reportTitle, dateRange }: { reportTitle: string; dateRange: string }) {
  return (
    <div className="hidden print:block mb-6 pb-4 border-b border-gray-200">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">FixFlow CMMS</h1>
          <p className="text-lg font-semibold text-gray-700 mt-1">{reportTitle}</p>
        </div>
        <div className="text-right text-sm text-gray-500">
          <p>{dateRange}</p>
          <p>Generated {new Date().toLocaleDateString()}</p>
        </div>
      </div>
    </div>
  )
}
