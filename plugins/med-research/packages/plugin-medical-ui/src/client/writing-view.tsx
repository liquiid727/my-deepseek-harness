/** Draft validation view for S08. */

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { DraftId } from '@medresearch/dsh-medical-contracts'
import type { MedViewProps } from './views.tsx'
import { MedFailure, useMedLoad } from './views.tsx'
import { MedViewFrame as MedPanel } from './components.tsx'
import css from './components.module.css'

/** Show a Draft body and let the user re-run current Evidence validation. */
export function WritingView({ remote, t, viewRequest, completeViewRequest }: MedViewProps) {
  const id = viewRequest?.focus === undefined || viewRequest.focus === '' ? undefined : viewRequest.focus as DraftId
  useEffect(() => { if (viewRequest !== null && id !== undefined) completeViewRequest() }, [viewRequest, id, completeViewRequest])
  const draft = useMedLoad(useCallback((signal: AbortSignal) => id === undefined ? Promise.resolve(undefined) : remote.knowledge.getDraft(id, signal), [remote, id]), [remote, id])
  const [validation, setValidation] = useState<string>()
  const validate = async (): Promise<void> => { if (id === undefined) return; const result = await remote.writing.validate(id); setValidation(result.valid ? t('writing.reviewable') : `${t('writing.stale')}: ${result.reasons.join('; ')}`) }
  return <MedPanel title={t('view.writing')} state={validation ?? t('writing.title')}>
    {id === undefined ? <p>{t('writing.empty')}</p> : null}
    {draft.error === undefined ? null : <MedFailure message={draft.error} label={t('action.retry')} onReload={draft.reload} />}
    {draft.value === undefined ? null : <article><h3 className={css.paperTitle}>{draft.value.title}</h3><p className={css.paperAbstract}>{draft.value.status}</p><pre className={css.readerBody}>{draft.value.body}</pre><Button size="sm" variant="primary" onClick={() => { void validate() }}>{t('writing.validate')}</Button></article>}
  </MedPanel>
}
