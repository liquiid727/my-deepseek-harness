/**
 * Dependency-free SVG templates for the P0/P1 chart types (SPEC-R001-S05-004).
 * The templates consume aggregate values only; callers remain responsible for
 * persisting the returned SVG through the normal run/artifact provenance path.
 *
 * Two rules the spec makes normative live here rather than in the caller:
 * a chart type that does not apply to the current analysis is reported as
 * disabled *with a reason* instead of being rendered empty, and a rendered
 * document is rejected before publication if it carries scripting or an
 * external reference.
 */

/** Effect scales a forest plot can combine; mixing them is not allowed. */
export const FOREST_SCALES = ['OR', 'RR', 'HR', 'MD', 'SMD'] as const

/** One effect estimate with its interval. */
export interface ForestEntry {
  label: string
  estimate: number
  lower: number
  upper: number
}

export type ChartSpec =
  | { type: 'histogram'; bins: readonly { label: string; count: number }[] }
  | { type: 'box_plot'; min: number; q1: number; median: number; q3: number; max: number }
  | { type: 'bar'; categories: readonly string[]; values: readonly number[] }
  | { type: 'scatter'; points: readonly { x: number; y: number }[] }
  | { type: 'forest_plot'; scale: (typeof FOREST_SCALES)[number]; entries: readonly ForestEntry[] }
  | { type: 'roc'; points: readonly { fpr: number; tpr: number }[]; auc: number }
  | { type: 'correlation'; method: 'pearson' | 'spearman'; sampleSize: number; cells: readonly { x: string; y: string; r: number }[] }
  | { type: 'kaplan_meier'; groups: readonly { label: string; points: readonly { time: number; survival: number }[] }[] }

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

function forestPlot(spec: Extract<ChartSpec, { type: 'forest_plot' }>): string {
  if (spec.entries.length === 0) throw new ChartSpecError('forest plot needs at least one effect')
  const rows = spec.entries.map((entry, index) => {
    const estimate = finite(entry.estimate, `entries[${index}].estimate`)
    const lower = finite(entry.lower, `entries[${index}].lower`)
    const upper = finite(entry.upper, `entries[${index}].upper`)
    if (!(lower <= estimate && estimate <= upper)) {
      throw new ChartSpecError(`forest entry ${index} must satisfy lower ≤ estimate ≤ upper`)
    }
    if (lower <= 0) throw new ChartSpecError(`forest entry ${index} must have a positive lower bound on a ratio scale`)
    return { label: entry.label, estimate, lower, upper }
  })
  const bounds = rows.flatMap(row => [row.lower, row.upper])
  const domain = range(bounds)
  const x = (value: number): number => LEFT + ((value - domain.min) / (domain.max - domain.min)) * PLOT_WIDTH
  const rowHeight = PLOT_HEIGHT / rows.length
  const body = rows.map((row, index) => {
    const cy = TOP + rowHeight * (index + 0.5)
    return `<path d="M${x(row.lower).toFixed(2)} ${cy.toFixed(2)}H${x(row.upper).toFixed(2)}" stroke="#333"/>`
      + `<rect x="${(x(row.estimate) - 4).toFixed(2)}" y="${(cy - 4).toFixed(2)}" width="8" height="8" fill="#4f81bd"><title>${esc(row.label)}: ${row.estimate} (${row.lower}–${row.upper})</title></rect>`
      + `<text x="${LEFT - 6}" y="${(cy + 4).toFixed(2)}" font-size="11" text-anchor="end">${esc(row.label)}</text>`
  }).join('')
  const nullLine = domain.min <= 1 && domain.max >= 1
    ? `<path d="M${x(1).toFixed(2)} ${TOP}V${TOP + PLOT_HEIGHT}" stroke="#999" stroke-dasharray="4 4"/>`
    : ''
  return frame(`Forest Plot (${spec.scale})`, `${nullLine}${body}`)
}

function roc(spec: Extract<ChartSpec, { type: 'roc' }>): string {
  if (spec.points.length < 2) throw new ChartSpecError('ROC needs at least two points')
  const auc = finite(spec.auc, 'auc')
  if (auc < 0 || auc > 1) throw new ChartSpecError('ROC AUC must be within [0, 1]')
  for (const [index, point] of spec.points.entries()) {
    finite(point.fpr, `points[${index}].fpr`)
    finite(point.tpr, `points[${index}].tpr`)
    if (point.fpr < 0 || point.fpr > 1 || point.tpr < 0 || point.tpr > 1) {
      throw new ChartSpecError(`ROC point ${index} must lie within the unit square`)
    }
  }
  const px = (value: number): number => LEFT + value * PLOT_WIDTH
  const py = (value: number): number => TOP + PLOT_HEIGHT - value * PLOT_HEIGHT
  const path = spec.points.map((point, index) => `${index === 0 ? 'M' : 'L'}${px(point.fpr).toFixed(2)} ${py(point.tpr).toFixed(2)}`).join('')
  return frame(`ROC (AUC ${auc})`, `<path d="M${px(0)} ${py(0)}L${px(1)} ${py(1)}" stroke="#999" stroke-dasharray="4 4"/><path d="${path}" fill="none" stroke="#4f81bd" stroke-width="2"/>`)
}

function correlation(spec: Extract<ChartSpec, { type: 'correlation' }>): string {
  if (!Number.isInteger(spec.sampleSize) || spec.sampleSize < 1) throw new ChartSpecError('correlation needs a positive integer sample size')
  if (spec.cells.length === 0) throw new ChartSpecError('correlation needs at least one coefficient')
  for (const [index, cell] of spec.cells.entries()) {
    const r = finite(cell.r, `cells[${index}].r`)
    if (r < -1 || r > 1) throw new ChartSpecError(`correlation coefficient ${index} must be within [-1, 1]`)
  }
  const size = PLOT_WIDTH / 2
  const cell = (x: number, yPosition: number, value: number, label: string): string => {
    const intensity = Math.min(Math.abs(value), 1)
    const fill = value >= 0
      ? `rgb(${Math.round(255 - intensity * 155)},${Math.round(255 - intensity * 155)},255)`
      : `rgb(255,${Math.round(255 - intensity * 155)},${Math.round(255 - intensity * 155)})`
    return `<rect x="${(LEFT + x * size).toFixed(2)}" y="${(TOP + yPosition * size).toFixed(2)}" width="${size.toFixed(2)}" height="${size.toFixed(2)}" fill="${fill}" stroke="#fff"><title>${esc(label)}: ${value}</title></rect>`
  }
  const cells = spec.cells.map((entry, index) => cell(index % 2, Math.floor(index / 2), entry.r, `${entry.x} × ${entry.y}`)).join('')
  return frame(`Correlation (${spec.method}, n=${spec.sampleSize})`, cells)
}

function kaplanMeier(spec: Extract<ChartSpec, { type: 'kaplan_meier' }>): string {
  if (spec.groups.length === 0) throw new ChartSpecError('Kaplan-Meier needs at least one group')
  for (const group of spec.groups) {
    if (group.points.length === 0) throw new ChartSpecError(`Kaplan-Meier group '${group.label}' has no points`)
    let lastTime = -1
    for (const [index, point] of group.points.entries()) {
      finite(point.time, `${group.label}.points[${index}].time`)
      finite(point.survival, `${group.label}.points[${index}].survival`)
      if (point.time < 0) throw new ChartSpecError('Kaplan-Meier times must be non-negative')
      if (point.time < lastTime) throw new ChartSpecError('Kaplan-Meier points must be ordered by time')
      if (point.survival < 0 || point.survival > 1) throw new ChartSpecError('Kaplan-Meier survival must be within [0, 1]')
      lastTime = point.time
    }
  }
  const maxTime = Math.max(...spec.groups.flatMap(group => group.points.map(point => point.time)), 1)
  const px = (time: number): number => LEFT + (time / maxTime) * PLOT_WIDTH
  const py = (survival: number): number => TOP + PLOT_HEIGHT - survival * PLOT_HEIGHT
  const palette = ['#4f81bd', '#c0504d', '#9bbb59', '#8064a2']
  const paths = spec.groups.map((group, groupIndex) => {
    let path = ''
    let previous = 1
    for (const [index, point] of group.points.entries()) {
      path += `${index === 0 ? 'M' : 'L'}${px(point.time).toFixed(2)} ${py(previous).toFixed(2)}`
      path += `L${px(point.time).toFixed(2)} ${py(point.survival).toFixed(2)}`
      previous = point.survival
    }
    return `<path d="${path}" fill="none" stroke="${palette[groupIndex % palette.length]!}" stroke-width="2"><title>${esc(group.label)}</title></path>`
  }).join('')
  return frame('Kaplan-Meier', paths)
}

/** Analysis facts a chart's applicability depends on (SPEC-R001-S05-004). */
export interface ChartContext {
  /** Effect scales present in the run; a forest plot needs exactly one shared scale. */
  effectScales?: readonly string[]
  /** True when the outcome is binary and predicted probabilities exist. */
  hasBinaryOutcome?: boolean
  hasPredictedProbabilities?: boolean
  /** Number of numeric variables available for a correlation matrix. */
  numericVariableCount?: number
  /** True when the dataset carries a non-negative time and a 0/1 event column. */
  hasSurvivalColumns?: boolean
  /** Number of groups available for a Kaplan-Meier comparison. */
  groupCount?: number
}

/** Applicability verdict for one chart request. */
export interface ChartApplicability {
  applicable: boolean
  /** Present exactly when `applicable` is false, so a UI never disables silently. */
  reason?: string
}

/**
 * Decide whether a chart type applies to the current analysis.
 *
 * An inapplicable chart is reported disabled *with its reason*; a chart that is
 * merely inconvenient is still applicable, so this never turns a valid result
 * into a disabled control.
 * @param spec - Requested chart.
 * @param context - Analysis facts.
 * @returns the applicability verdict.
 */
export function chartApplicability(spec: ChartSpec, context: ChartContext): ChartApplicability {
  switch (spec.type) {
    case 'histogram':
    case 'box_plot':
    case 'scatter':
      return (context.numericVariableCount ?? 1) >= 1
        ? { applicable: true }
        : { applicable: false, reason: 'chart.reason.needsNumericVariable' }
    case 'forest_plot': {
      const scales = [...new Set(context.effectScales ?? [spec.scale])]
      if (scales.length > 1) return { applicable: false, reason: 'chart.reason.mixedEffectScales' }
      return spec.entries.length >= 1
        ? { applicable: true }
        : { applicable: false, reason: 'chart.reason.needsEffectEstimate' }
    }
    case 'roc':
      if (context.hasBinaryOutcome !== true) return { applicable: false, reason: 'chart.reason.needsBinaryOutcome' }
      if (context.hasPredictedProbabilities !== true) return { applicable: false, reason: 'chart.reason.needsPredictedProbability' }
      return { applicable: true }
    case 'correlation':
      return (context.numericVariableCount ?? 0) >= 2
        ? { applicable: true }
        : { applicable: false, reason: 'chart.reason.needsTwoNumericVariables' }
    case 'kaplan_meier':
      if (context.hasSurvivalColumns !== true) return { applicable: false, reason: 'chart.reason.needsSurvivalColumns' }
      return { applicable: true }
    default:
      // Fail loud rather than silently treating an unknown request as usable.
      return { applicable: false, reason: 'chart.reason.unknownChartType' }
  }
}

/** Patterns that make a rendered chart unsafe to publish. */
const UNSAFE_SVG_PATTERNS: ReadonlyArray<readonly [RegExp, string]> = [
  [/<script\b/iu, 'script element'],
  [/<foreignObject\b/iu, 'foreignObject element'],
  [/\son[a-z]+\s*=/iu, 'inline event handler'],
  [/\b(?:xlink:)?href\s*=\s*"(?!#)/iu, 'external reference'],
  [/\burl\(\s*['"]?(?!#)/iu, 'external CSS reference'],
]

/**
 * Reject a rendered chart that would execute or fetch anything.
 *
 * Publication is the point of no return for a statistical artifact, so the
 * check runs before the bytes are stored and names the offending construct.
 * @param svg - Rendered SVG document.
 * @throws ChartSpecError naming the unsafe construct.
 */
export function assertSafeSvg(svg: string): void {
  for (const [pattern, label] of UNSAFE_SVG_PATTERNS) {
    if (pattern.test(svg)) throw new ChartSpecError(`rendered chart contains a ${label}`)
  }
}

/** Provenance a published chart artifact must carry (SPEC-R001-S05-004). */
export interface ChartProvenance {
  analysisRunId: string
  /** SHA-256 of the rendered bytes, computed by the artifact service. */
  hash: string
  /** Hash the caller claims; a mismatch means the bytes changed in flight. */
  expectedHash: string
}

/**
 * Reject a chart that cannot be attributed to one successful run.
 * @param provenance - Run identity and the two hashes.
 * @throws ChartSpecError when provenance is missing or the hash does not match.
 */
export function assertPublishableChart(provenance: ChartProvenance): void {
  if (provenance.analysisRunId.trim() === '') throw new ChartSpecError('chart artifact must name its analysis run')
  if (provenance.hash !== provenance.expectedHash) throw new ChartSpecError('chart artifact hash does not match the rendered bytes')
}

/** Render one validated chart specification as a standalone SVG document. */
export function renderChartSvg(spec: ChartSpec): string {
  switch (spec.type) {
    case 'histogram': return histogram(spec)
    case 'box_plot': return boxPlot(spec)
    case 'bar': return bar(spec)
    case 'scatter': return scatter(spec)
    case 'forest_plot': return forestPlot(spec)
    case 'roc': return roc(spec)
    case 'correlation': return correlation(spec)
    case 'kaplan_meier': return kaplanMeier(spec)
  }
}
