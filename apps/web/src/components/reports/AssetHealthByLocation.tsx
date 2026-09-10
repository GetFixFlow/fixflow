import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface LocationHealth { location: string; total: number; operational: number; degraded: number; down: number; health_score: number }

export function AssetHealthByLocation({ data }: { data: LocationHealth[] }) {
  return (
    <div className="space-y-3">
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} layout="vertical" margin={{ top: 5, right: 5, bottom: 5, left: 80 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis type="number" tick={{ fontSize: 10 }} />
          <YAxis type="category" dataKey="location" tick={{ fontSize: 10 }} width={75} />
          <Tooltip />
          <Legend />
          <Bar dataKey="operational" name="Operational" fill="#22c55e" stackId="a" />
          <Bar dataKey="degraded" name="Degraded" fill="#eab308" stackId="a" />
          <Bar dataKey="down" name="Down" fill="#ef4444" stackId="a" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-gray-400 border-b border-gray-100 dark:border-gray-700">
            <th className="text-left py-1">Location</th>
            <th className="text-right py-1">Total</th>
            <th className="text-right py-1">Operational</th>
            <th className="text-right py-1">Health Score</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.location} className="border-b border-gray-50 dark:border-gray-800">
              <td className="py-1.5 font-medium">{row.location}</td>
              <td className="text-right">{row.total}</td>
              <td className="text-right">{row.operational}</td>
              <td className={`text-right font-semibold ${row.health_score >= 90 ? 'text-green-600' : row.health_score >= 70 ? 'text-yellow-600' : 'text-red-500'}`}>
                {row.health_score}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
