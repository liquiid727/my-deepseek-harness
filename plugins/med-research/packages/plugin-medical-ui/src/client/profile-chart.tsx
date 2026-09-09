import type { Dataset } from '@medresearch/dsh-medical-contracts'
import type { MedUiKey } from '../i18n/index.ts'

/** Translator narrowed to the labels used by the profile chart. */
type ChartTranslate = (key: MedUiKey) => string

/** Render aggregate missing-value counts from a dataset profile as an SVG bar chart. */
export function MissingValuesChart({ dataset, t }: { dataset: Dataset; t: ChartTranslate }) {
  const columns = dataset.schema
  if (columns.length === 0) return null
  const max = Math.max(...columns.map(column => column.missingCount), 1)
  const width = 520
  const height = 180
  const left = 24
  const bottom = 28
  const plotHeight = height - bottom
  const barWidth = (width - left) / columns.length
  return (
    <figure style={{ margin: '12px 0 0' }}>
      <figcaption style={{ fontSize: 12, marginBottom: 4 }}>{t('statistics.MISSING_VALUES')}</figcaption>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={t('statistics.MISSING_VALUES')}
        data-med-chart="bar"
      >
        <title>{t('statistics.MISSING_VALUES')}</title>
        <path d={`M${left} 0V${plotHeight}H${width}`} stroke="currentColor" fill="none" />
        {columns.map((column, index) => {
          const barHeight = (column.missingCount / max) * (plotHeight - 8)
          const x = left + index * barWidth + 2
          const y = plotHeight - barHeight
          return (
            <g key={column.name}>
              <rect x={x} y={y} width={Math.max(barWidth - 4, 1)} height={barHeight} fill="#4f81bd">
                <title>{`${column.name}: ${column.missingCount}`}</title>
              </rect>
              <text x={x + Math.max(barWidth - 4, 1) / 2} y={height - 8} textAnchor="middle" fontSize="9">
                {column.name.slice(0, 12)}
              </text>
            </g>
          )
        })}
      </svg>
    </figure>
  )
}
