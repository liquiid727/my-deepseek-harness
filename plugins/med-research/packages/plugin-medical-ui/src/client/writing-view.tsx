/**
 * Draft editor section for S08. It is a section of the library page, not a
 * registered View, so the owning page passes the selected draft.
 * @module @medresearch/dsh-plugin-medical-ui/src/client/writing-view
 */

import { useCallback, useState } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { DraftId } from '@medresearch/dsh-medical-contracts'
import type { MedViewProps } from './views.tsx'
import { MedFailure, useMedLoad } from './views.tsx'
import { MedViewFrame as MedPanel } from './components.tsx'
import css from './components.module.css'

/** Show a Draft body and let the user re-run current Evidence validation. */
export function MedDraftEditor({ remote, t, draftId }: {
  readonly remote: MedViewProps['remote']
  readonly t: MedViewProps['t']
  readonly draftId: DraftId
}) {
  const draft = useMedLoad(useCallback((signal: AbortSignal) => remote.knowledge.getDraft(draftId, signal), [remote, draftId]), [remote, draftId])
  const [validation, setValidation] = useState<string>()
  const validate = async (): Promise<void> => {
    const result = await remote.writing.validate(draftId)
    setValidation(result.valid ? t('writing.reviewable') : `${t('writing.stale')}: ${result.reasons.join('; ')}`)
  }
  return (
    <MedPanel title={t('view.writing')} state={validation ?? t('writing.title')}>
      {draft.error === undefined ? null : <MedFailure message={draft.error} label={t('action.retry')} onReload={draft.reload} />}
      {draft.value === undefined
        ? <p className="state">{t('home.loading')}</p>
        : (
          <article>
            <h3 className={css.paperTitle}>{draft.value.title}</h3>
            <p className={css.paperAbstract}>{draft.value.status}</p>
            <pre className={css.readerBody}>{draft.value.body}</pre>
            <Button size="sm" variant="primary" onClick={() => { void validate() }}>{t('writing.validate')}</Button>
          </article>
        )}
    </MedPanel>
  )
}
