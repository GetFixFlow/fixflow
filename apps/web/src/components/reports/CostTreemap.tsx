import { Treemap, ResponsiveContainer, Tooltip } from 'recharts'
import { formatCurrency } from '@/utils/chartUtils'
import { CHART_COLORS } from '@/utils/chartUtils'

interface CostNode { name: string; cost: number; children?: CostNode[] }

const COLORS = Object.values(CHART_COLORS)

interface CustomContentProps {
  x?: number; y?: number; width?: number; height?: number;
  name?: string; value?: number; depth?: number; index?: number
}

function CustomContent({ x = 0, y = 0, width = 0, height = 0, name, value, depth = 0, index = 0 }: CustomContentProps) {
  if (width < 30 || height < 20) return <rect x={x} y={y} width={width} height={height} fill={COLORS[index % COLORS.length]} opacity={0.8} />
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={COLORS[index % COLORS.length]} opacity={0.85} rx={2} />
      {width > 60 && height > 30 && (
        <>
          <text x={x + width / 2} y={y + height / 2 - 6} textAnchor="middle" fill="#fff" fontSize={11} fontWeight="600" className="truncate">
            {name}
          </text>
          {value && (
            <text x={x + width / 2} y={y + height / 2 + 10} textAnchor="middle" fill="rgba(255,255,255,0.8)" fontSize={10}>
              {formatCurrency(value)}
            </text>
          )}
        </>
      )}
    </g>
  )
}

export function CostTreemap({ data }: { data: CostNode[] }) {
  const treeData = data.map((d) => ({ ...d, size: d.cost }))
  return (
    <ResponsiveContainer width="100%" height={300}>
      <Treemap data={treeData} dataKey="cost" nameKey="name" content={<CustomContent />}>
        <Tooltip formatter={(v: number) => [formatCurrency(v), 'Cost']} />
      </Treemap>
    </ResponsiveContainer>
  )
}
