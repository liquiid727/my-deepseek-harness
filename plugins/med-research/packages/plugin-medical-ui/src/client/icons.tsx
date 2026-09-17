/**
 * Inline SVG icon set of the Med Research client. The bundle inlines these
 * components (the only runtime imports are React), and product rules forbid
 * emoji or bare Unicode glyphs as UI icons. Every icon inherits
 * `currentColor`, sizes through the `size` prop, and is decorative by
 * default: buttons carry their own localized `aria-label`.
 * @module @medresearch/dsh-plugin-medical-ui/src/client/icons
 */

import type { ReactElement } from 'react'

/** Shared props of every Med Research icon. */
export interface MedIconProps {
  /** Square edge in pixels. */
  readonly size?: number
}

/** Build one stroke icon from path data. */
function strokeIcon(paths: readonly string[], viewBox = '0 0 24 24'): (props: MedIconProps) => ReactElement {
  return function Icon({ size = 16 }: MedIconProps) {
    return (
      <svg
        aria-hidden="true"
        fill="none"
        height={size}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        viewBox={viewBox}
        width={size}
      >
        {paths.map(d => <path d={d} key={d} />)}
      </svg>
    )
  }
}

/** Filled medical brand mark: rounded tile with a cross. */
export function MedBrandMark({ size = 24 }: MedIconProps): ReactElement {
  return (
    <svg aria-hidden="true" fill="none" height={size} viewBox="0 0 24 24" width={size}>
      <rect fill="currentColor" height={22} rx={6} width={22} x={1} y={1} />
      <path
        d="M12 6.4v11.2M6.4 12h11.2"
        stroke="var(--dsw-alias-label-on-accent)"
        strokeLinecap="round"
        strokeWidth={2.6}
      />
    </svg>
  )
}

/** Workbench home. */
export const MedHomeIcon = strokeIcon(['M4 11.2 12 4.4l8 6.8', 'M6.2 9.8v9h11.6v-9'])

/** Literature research (magnifier). */
export const MedResearchIcon = strokeIcon([
  'M10.8 4.4a6.4 6.4 0 1 1 0 12.8 6.4 6.4 0 0 1 0-12.8Z',
  'M15.6 15.6 20 20',
])

/** Paper reader / knowledge library (open book). */
export const MedLibraryIcon = strokeIcon([
  'M12 6.2C10.4 4.9 8 4.4 4.6 4.6v13.2c3.4-.2 5.8.3 7.4 1.6',
  'M12 6.2c1.6-1.3 4-1.8 7.4-1.6v13.2c-3.4-.2-5.8.3-7.4 1.6',
  'M12 6.2v13.2',
])

/** Statistics (bar chart). */
export const MedStatisticsIcon = strokeIcon([
  'M5.4 19.4V13',
  'M12 19.4V4.6',
  'M18.6 19.4v-9.2',
])

/** Skills center (2×2 grid). */
export const MedSkillsIcon = strokeIcon([
  'M4.6 4.6h5.6v5.6H4.6z',
  'M13.8 4.6h5.6v5.6h-5.6z',
  'M4.6 13.8h5.6v5.6H4.6z',
  'M13.8 13.8h5.6v5.6h-5.6z',
])

/** Paper document. */
export const MedPaperIcon = strokeIcon([
  'M6 3.8h8l4 4v12.4H6z',
  'M14 3.8v4h4',
])

/** Evidence (verified check inside a shield). */
export const MedEvidenceIcon = strokeIcon([
  'M12 3.6 19 6v6c0 4.2-2.9 7-7 8.4C7.9 19 5 16.2 5 12V6Z',
  'M9 11.8l2.2 2.2L15.4 9.6',
])

/** Dataset (cylinder). */
export const MedDatasetIcon = strokeIcon([
  'M12 4.4c-4 0-7 1.1-7 2.6s3 2.6 7 2.6 7-1.1 7-2.6-3-2.6-7-2.6Z',
  'M5 7v10c0 1.5 3 2.6 7 2.6s7-1.1 7-2.6V7',
  'M5 12c0 1.5 3 2.6 7 2.6s7-1.1 7-2.6',
])

/** Analysis run (flask). */
export const MedAnalysisIcon = strokeIcon([
  'M9.6 4.4h4.8',
  'M10.4 4.4v5L5.8 17a2 2 0 0 0 1.8 2.8h8.8a2 2 0 0 0 1.8-2.8l-4.6-7.6v-5',
  'M8 14.6h8',
])

/** Chart artifact (line chart). */
export const MedChartIcon = strokeIcon([
  'M4.6 4.6v14.8h14.8',
  'M7.6 14.6l3.4-4 2.8 2.4 4.2-5.4',
])

/** Send the research question (arrow up). */
export const MedSendIcon = strokeIcon([
  'M12 19V5.6',
  'M6.4 11.2 12 5.6l5.6 5.6',
])

/** Create / add. */
export const MedPlusIcon = strokeIcon(['M12 5.4v13.2', 'M5.4 12h13.2'])

/** Archive (box). */
export const MedArchiveIcon = strokeIcon([
  'M4.6 4.6h14.8v4H4.6z',
  'M6 8.6v10.8h12V8.6',
  'M10.2 12.4h3.6',
])

/** Restore from archive (counterclockwise arrow). */
export const MedRestoreIcon = strokeIcon([
  'M5 10a7.2 7.2 0 1 1 1.4 6.4',
  'M5 5.4V10h4.6',
])

/** Rotate the inspiration batch. */
export const MedInspireIcon = strokeIcon([
  'M9.2 4.9a7.2 7.2 0 0 1 9.4 6.9',
  'M19.8 6.9v5h-5',
  'M14.8 19.1a7.2 7.2 0 0 1-9.4-6.9',
  'M4.2 17.1v-5h5',
])

/** Search roster. */
export const MedSearchIcon = strokeIcon([
  'M10.6 4.6a6 6 0 1 1 0 12 6 6 0 0 1 0-12Z',
  'M14.9 14.9 19.4 19.4',
])

/** Forward affordance for cards and rows. */
export const MedArrowIcon = strokeIcon(['M5 12h13.4', 'M12.8 6.4 18.4 12l-5.6 5.6'])
