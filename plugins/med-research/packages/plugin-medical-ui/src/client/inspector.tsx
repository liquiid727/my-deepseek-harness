/**
 * The medical right-column inspector (0917 图 1–4 的右侧检视栏).
 *
 * This is a tab type in the host's right Sidebar rather than a column of our
 * own: the host owns the column's geometry, its collapse gesture and its
 * docking kit, and `ctx.sidebarRightTabs` is the seat a type registers through.
 * The plugin adds the type (stage one) and its body under the same id
 * (stage two); the host draws the strip, the close control and the resize
 * handle.
 *
 * What the body shows follows the object the centre is on — the prototype's
 * rule that the right column is an inspector of the current selection, not a
 * second chat window. This first slice covers the project: the bound project's
 * background, its research-question fields, the quick entries, and the panel's
 * own message box. Segments whose capability is not in service yet render
 * disabled with their reason instead of disappearing.
 *
 * The message box is plugin-built and sends through
 * `ISession.prompt(content, 'queue')`, which is the public behaviour verb for
 * putting a turn into a session. It carries no attachments and no slash
 * commands — those stay with the host composer — so the page it sits on must
 * not also show the host composer.
 * @module @medresearch/dsh-plugin-medical-ui/src/client/inspector
 */

import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: the right Sidebar's tab-body seat and its information hook. This
// import also pulls the package's SlotMap and params merges into the program.
import type { UseSidebarRightTabInfo } from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import type { MedUiKey } from '../i18n/index.ts'
import type { MedViewInjected } from './locales.ts'
import { NS } from './locales.ts'
import { MedPageTabs, MedAsyncState, type MedPageTab } from './components.tsx'
import { useMedLoad, useMedResolvedSessionProject } from './views.tsx'
import { usePanelInputClaimed } from './panel-input.ts'
import { MedEvidenceIcon, MedInspireIcon, MedPaperIcon, MedResearchIcon, MedSendIcon } from './icons.tsx'

/** Registered identity of the inspector tab type. A package name is the natural value. */
export const MED_INSPECTOR_ID = '@medresearch/dsh-plugin-medical-ui/inspector'

/** The page kind `openTab` names to open the inspector. */
export const MED_INSPECTOR_KIND = 'med-inspector'

/** Segments of the project inspector (图 1 结果/上下文/笔记/证据). */
type InspectorTab = 'result' | 'context' | 'note' | 'evidence'

/** Injected face of the inspector body; the project and session come from the seat. */
export interface MedInspectorInjected extends MedViewInjected {
  /** Activate a registered Conversation View on the current Session. */
  readonly openView: (view: string, focus: string) => void
  /**
   * Put one text turn into the given Session.
   * @param sessionId - the Session the inspector is drawing.
   * @param text - the message body, already trimmed and non-empty.
   * @returns completion, or the reason the Session refused it.
   */
  readonly promptSession: (sessionId: string, text: string) => Promise<void>
}

/** Composed props of the inspector body: the tab seat, the injected face, and copy. */
export type MedInspectorProps =
  & PropsRuntime<'sidebar.right.pane.tab'>
  & InjectFace<MedInspectorInjected>
  & PropsLocale<typeof NS>
  & { readonly useTabInfo: UseSidebarRightTabInfo }

/**
 * One labelled row of the inspector's definition list.
 * @param props - Localized label and the value, or the placeholder for a field nobody filled.
 * @returns the row.
 */
function Row({ label, value, empty }: {
  readonly label: string
  readonly value: string | undefined
  readonly empty: string
}): ReactElement {
  return (
    <div className="medInspectRow" data-empty={value === undefined || value === '' || undefined}>
      <dt className="medInspectKey">{label}</dt>
      <dd className="medInspectValue">{value === undefined || value === '' ? empty : value}</dd>
    </div>
  )
}

/** The project inspector body: heading, segment row, and one panel per segment. */
export function MedInspectorBody(props: MedInspectorProps): ReactElement | null {
  const { remote, openView, promptSession, t, sessionId, useSessions } = props
  // A page with no centre input hands its box to this panel; a page that keeps
  // the host composer does not, and then this panel must not show a second one.
  const ownsInput = usePanelInputClaimed()
  const [tab, setTab] = useState<InspectorTab>('result')
  const [draft, setDraft] = useState('')
  const [editing, setEditing] = useState(false)
  const [backgroundDraft, setBackgroundDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string>()

  const cwd = useSessions(snapshot => snapshot.byId[sessionId]?.cwd)
  const binding = useMedResolvedSessionProject(remote, sessionId, cwd)
  const projectId = binding.value?.projectId
  const project = useMedLoad(
    useCallback(
      (signal: AbortSignal) => projectId === undefined
        ? Promise.resolve(undefined)
        : remote.projects.get(projectId, signal),
      [remote, projectId],
    ),
    [projectId],
  )
  const record = project.value

  // Leaving edit mode or switching projects must not carry the other project's
  // half-typed background into the box.
  useEffect(() => { setEditing(false) }, [projectId])
  useEffect(() => { setBackgroundDraft(record?.background ?? '') }, [record?.background])

  const segments = useMemo<readonly MedPageTab<InspectorTab>[]>(() => [
    { id: 'result', label: t('inspector.tab.result') },
    { id: 'context', label: t('inspector.tab.context') },
    { id: 'note', label: t('inspector.tab.note'), reason: t('inspector.pendingService') },
    { id: 'evidence', label: t('inspector.tab.evidence'), reason: t('inspector.pendingService') },
    // `t` is the only dependency that changes the roster.
  ], [t])

  const saveBackground = async (): Promise<void> => {
    if (projectId === undefined || record === undefined) return
    setBusy(true)
    setFailure(undefined)
    try {
      await remote.projects.update(projectId, { background: backgroundDraft }, record.updatedAt)
      setEditing(false)
      project.reload()
    } catch (cause) {
      setFailure(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(false)
    }
  }

  const send = async (): Promise<void> => {
    const text = draft.trim()
    if (text === '' || busy) return
    setBusy(true)
    setFailure(undefined)
    try {
      await promptSession(sessionId, text)
      setDraft('')
    } catch (cause) {
      // The draft survives a refusal: the acceptance rules keep the input and
      // let the user retry rather than losing what they typed.
      setFailure(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(false)
    }
  }

  if (binding.loading && binding.value === undefined) {
    return <div className="medInspect"><p className="state">{t('home.loading')}</p></div>
  }
  if (binding.error !== undefined) {
    return (
      <div className="medInspect">
        <MedAsyncState message={`${t('inspector.title')}: ${binding.error}`} retryLabel={t('error.load')} onRetry={binding.reload} />
      </div>
    )
  }
  if (projectId === undefined) {
    return <div className="medInspect"><p className="state">{t('inspector.noProject')}</p></div>
  }

  const quick: readonly {
    id: string
    label: MedUiKey
    Icon: (props: { readonly size?: number }) => ReactElement
    reason?: MedUiKey
  }[] = [
    { id: 'literature', label: 'inspector.quick.literature', Icon: MedResearchIcon },
    { id: 'plan', label: 'inspector.quick.plan', Icon: MedPaperIcon, reason: 'inspector.quick.planReason' },
    { id: 'extract', label: 'inspector.quick.extract', Icon: MedEvidenceIcon, reason: 'inspector.quick.extractReason' },
    { id: 'note', label: 'inspector.quick.note', Icon: MedInspireIcon },
  ]

  return (
    <div className="medInspect">
      <div className="medInspectHead">
        <span aria-hidden="true" className="medInspectMark"><MedInspireIcon size={18} /></span>
        <span className="medInspectTitle">{t('inspector.title')}</span>
      </div>
      <MedPageTabs label={t('inspector.title')} onChange={setTab} tabs={segments} value={tab} />

      {project.error === undefined ? null : (
        <MedAsyncState message={project.error} retryLabel={t('error.load')} onRetry={project.reload} />
      )}

      {tab === 'result' ? (
        <>
          <section className="medInspectSection">
            <div className="medInspectSectionHead">
              <h3 className="medInspectSectionTitle">{t('inspector.background')}</h3>
              {editing
                ? null
                : (
                  <Button
                    onClick={() => { setEditing(true) }}
                    size="sm"
                    variant="outline"
                  >
                    {t('inspector.edit')}
                  </Button>
                )}
            </div>
            {editing ? (
              <div className="medInspectEditor">
                <textarea
                  aria-label={t('inspector.background')}
                  className="medInspectTextarea"
                  onChange={event => { setBackgroundDraft(event.currentTarget.value) }}
                  rows={4}
                  value={backgroundDraft}
                />
                <div className="medInspectEditorActions">
                  <Button onClick={() => { setEditing(false); setBackgroundDraft(record?.background ?? '') }} size="sm" variant="ghost">
                    {t('action.cancel')}
                  </Button>
                  <Button onClick={() => { void saveBackground() }} size="sm" variant="primary">
                    {busy ? t('inspector.saving') : t('action.save')}
                  </Button>
                </div>
              </div>
            ) : (
              <p className="medInspectBody">
                {record?.background === undefined || record.background === ''
                  ? t('inspector.backgroundEmpty')
                  : record.background}
              </p>
            )}
          </section>

          <section className="medInspectSection">
            <h3 className="medInspectSectionTitle">{t('inspector.question')}</h3>
            <dl className="medInspectList">
              <Row empty={t('inspector.unfilled')} label={t('inspector.researchQuestion')} value={record?.researchQuestion} />
              <Row empty={t('inspector.unfilled')} label={t('inspector.population')} value={record?.population} />
              <Row empty={t('inspector.unfilled')} label={t('inspector.intervention')} value={record?.interventionOrExposure} />
              <Row empty={t('inspector.unfilled')} label={t('inspector.comparison')} value={record?.comparison} />
              <Row empty={t('inspector.unfilled')} label={t('inspector.outcome')} value={record?.outcome} />
            </dl>
          </section>

          <section className="medInspectSection">
            <h3 className="medInspectSectionTitle">{t('inspector.quick')}</h3>
            <div className="medInspectQuick">
              {quick.map(({ id, label, Icon, reason }) => (
                <Button
                  aria-disabled={reason === undefined ? undefined : true}
                  className="medInspectQuickItem"
                  data-unavailable={reason === undefined ? undefined : true}
                  key={id}
                  onClick={() => {
                    if (reason !== undefined) return
                    if (id === 'literature') openView('med-research', '')
                    else openView('med-knowledge', '')
                  }}
                  size="sm"
                  title={reason === undefined ? undefined : t(reason)}
                  variant="outline"
                >
                  <span aria-hidden="true" className="medInspectQuickIcon"><Icon size={16} /></span>
                  {t(label)}
                </Button>
              ))}
            </div>
          </section>

          <section className="medInspectSection medInspectAsk">
            <h3 className="medInspectSectionTitle">{t('inspector.ask')}</h3>
            <ul className="medInspectAskList">
              {(['inspector.ask.1', 'inspector.ask.2', 'inspector.ask.3'] as const).map(key => (
                <li key={key}>
                  <button
                    className="medInspectAskItem"
                    onClick={() => { setDraft(t(key)) }}
                    type="button"
                  >
                    <span aria-hidden="true" className="medInspectAskIcon"><MedInspireIcon size={14} /></span>
                    <span>{t(key)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : null}

      {tab === 'context' ? (
        <section className="medInspectSection">
          <h3 className="medInspectSectionTitle">{t('inspector.context')}</h3>
          <dl className="medInspectList">
            <Row empty={t('inspector.unfilled')} label={t('inspector.project')} value={record?.name} />
            <Row empty={t('inspector.unfilled')} label={t('inspector.status')} value={record === undefined ? undefined : t(record.status === 'active' ? 'home.status.active' : 'home.status.archived')} />
            <Row empty={t('inspector.unfilled')} label={t('inspector.keywords')} value={record?.keywords.join(' · ')} />
            <Row empty={t('inspector.unfilled')} label={t('inspector.created')} value={record?.createdAt} />
            <Row empty={t('inspector.unfilled')} label={t('inspector.updated')} value={record?.updatedAt} />
          </dl>
        </section>
      ) : null}

      {failure === undefined ? null : (
        <MedAsyncState message={failure} retryLabel={t('action.retry')} onRetry={() => { setFailure(undefined) }} />
      )}

      {ownsInput ? (
        <div className="medInspectComposer">
          <textarea
            aria-label={t('inspector.input')}
            className="medInspectTextarea"
            onChange={event => { setDraft(event.currentTarget.value) }}
            onKeyDown={event => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                void send()
              }
            }}
            placeholder={t('inspector.inputPlaceholder')}
            rows={2}
            value={draft}
          />
          <div className="medInspectComposerBar">
            <span className="medInspectComposerHint">{t('inspector.inputHint')}</span>
            <Button
              aria-label={t('inspector.send')}
              className="medInspectSend"
              disabled={busy || draft.trim() === ''}
              onClick={() => { void send() }}
              size="sm"
              variant="primary"
            >
              <MedSendIcon size={16} />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
