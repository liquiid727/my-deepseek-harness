/**
 * Dependency-free SVG templates for the four P0 chart types (PRD §26/§36).
 * The templates consume aggregate values only; callers remain responsible for
 * persisting the returned SVG through the normal run/artifact provenance path.
 */

export type ChartSpec =
  | { type: 'histogram'; bins: readonly { label: string; count: number }[] }
  | { type: 'box_plot'; min: number; q1: number; median: number; q3: number; max: number }
  | { type: 'bar'; categories: readonly string[]; values: readonly number[] }
  | { type: 'scatter'; points: readonly { x: number; y: number }[] }

const WIDTH = 640
const HEIGHT = 400
const LEFT = 56
const RIGHT = 20
const TOP = 24
const BOTTOM = 56
const PLOT_WIDTH = WIDTH - LEFT - RIGHT
const PLOT_HEIGHT = HEIGHT - TOP - BOTTOM

/** Error raised when a chart template receives non-finite or inconsistent data. */
export class ChartSpecError extends Error {
  override readonly name = 'ChartSpecError'
}

function finite(value: number, name: string): number {
  if (!Number.isFinite(value)) throw new ChartSpecError(`${name} must be finite`)
  return value
}

function esc(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
}

function frame(title: string, body: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-label="${esc(title)}"><title>${esc(title)}</title><rect width="100%" height="100%" fill="white"/><g stroke="#333" fill="none"><path d="M${LEFT} ${TOP}V${TOP + PLOT_HEIGHT}H${LEFT + PLOT_WIDTH}"/></g>${body}</svg>`
}

function range(values: readonly number[]): { min: number; max: number } {
  const numbers = values.map((value, index) => finite(value, `values[${index}]`))
  if (numbers.length === 0) throw new ChartSpecError('chart data must not be empty')
  const min = Math.min(...numbers)
  const max = Math.max(...numbers)
  return { min, max: min === max ? min + 1 : max }
}

function y(value: number, min: number, max: number): number {
  return TOP + PLOT_HEIGHT - ((value - min) / (max - min)) * PLOT_HEIGHT
}

function histogram(spec: Extract<ChartSpec, { type: 'histogram' }>): string {
  if (spec.bins.length === 0) throw new ChartSpecError('histogram bins must not be empty')
  const counts = spec.bins.map((bin, index) => finite(bin.count, `bins[${index}].count`))
  if (counts.some(count => count < 0)) throw new ChartSpecError('histogram counts must be non-negative')
  const max = Math.max(...counts, 1)
  const width = PLOT_WIDTH / spec.bins.length
  const bars = spec.bins.map((bin, index) => {
    const height = (bin.count / max) * PLOT_HEIGHT
    const x = LEFT + index * width + 1
    return `<rect x="${x.toFixed(2)}" y="${(TOP + PLOT_HEIGHT - height).toFixed(2)}" width="${Math.max(width - 2, 1).toFixed(2)}" height="${height.toFixed(2)}" fill="#4f81bd"><title>${esc(bin.label)}: ${bin.count}</title></rect>`
  }).join('')
  return frame('Histogram', bars)
}

function boxPlot(spec: Extract<ChartSpec, { type: 'box_plot' }>): string {
  const values = [spec.min, spec.q1, spec.median, spec.q3, spec.max].map((value, index) => finite(value, `box[${index}]`))
  if (!(values[0]! <= values[1]! && values[1]! <= values[2]! && values[2]! <= values[3]! && values[3]! <= values[4]!)) {
    throw new ChartSpecError('box plot values must be ordered min ≤ q1 ≤ median ≤ q3 ≤ max')
  }
  const { min, max } = range(values)
  const center = LEFT + PLOT_WIDTH / 2
  const boxWidth = 120
  const yMin = y(spec.min, min, max)
  const yQ1 = y(spec.q1, min, max)
  const yMedian = y(spec.median, min, max)
  const yQ3 = y(spec.q3, min, max)
  const yMax = y(spec.max, min, max)
  return frame('Box Plot', `<path d="M${center} ${yMax}V${yQ3}M${center} ${yQ1}V${yMin}M${center - 35} ${yMax}H${center + 35}M${center - 35} ${yMin}H${center + 35}" stroke="#333"/><rect x="${center - boxWidth / 2}" y="${yQ3}" width="${boxWidth}" height="${Math.max(yQ1 - yQ3, 1)}" fill="#9bbb59" stroke="#333"/><path d="M${center - boxWidth / 2} ${yMedian}H${center + boxWidth / 2}" stroke="#333" stroke-width="3"/>`)
}

function bar(spec: Extract<ChartSpec, { type: 'bar' }>): string {
  if (spec.categories.length === 0 || spec.categories.length !== spec.values.length) throw new ChartSpecError('bar categories and values must be non-empty and have equal length')
  const values = spec.values.map((value, index) => finite(value, `values[${index}]`))
  if (values.some(value => value < 0)) throw new ChartSpecError('bar values must be non-negative')
  const max = Math.max(...values, 1)
  const width = PLOT_WIDTH / values.length
  const bars = values.map((value, index) => {
    const height = (value / max) * PLOT_HEIGHT
    const x = LEFT + index * width + width * 0.15
    return `<rect x="${x.toFixed(2)}" y="${(TOP + PLOT_HEIGHT - height).toFixed(2)}" width="${(width * 0.7).toFixed(2)}" height="${height.toFixed(2)}" fill="#c0504d"><title>${esc(spec.categories[index]!)}: ${value}</title></rect>`
  }).join('')
  return frame('Bar Chart', bars)
}

function scatter(spec: Extract<ChartSpec, { type: 'scatter' }>): string {
  if (spec.points.length === 0) throw new ChartSpecError('scatter points must not be empty')
  const xs = spec.points.map((point, index) => finite(point.x, `points[${index}].x`))
  const ys = spec.points.map((point, index) => finite(point.y, `points[${index}].y`))
  const xRange = range(xs)
  const yRange = range(ys)
  const points = spec.points.map((point, index) => {
    const px = LEFT + ((point.x - xRange.min) / (xRange.max - xRange.min)) * PLOT_WIDTH
    const py = y(point.y, yRange.min, yRange.max)
    return `<circle cx="${px.toFixed(2)}" cy="${py.toFixed(2)}" r="4" fill="#8064a2"><title>${point.x}, ${point.y}</title></circle>`
  }).join('')
  return frame('Scatter', points)
}

/** Render one validated P0 chart specification as a standalone SVG document. */
export function renderChartSvg(spec: ChartSpec): string {
  switch (spec.type) {
    case 'histogram': return histogram(spec)
    case 'box_plot': return boxPlot(spec)
    case 'bar': return bar(spec)
    case 'scatter': return scatter(spec)
  }
}
