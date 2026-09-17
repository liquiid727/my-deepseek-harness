/**
 * The complete Remote surface of the ten med services (SPEC §30). The test
 * pins the namespace binding and the decorated method set per service, so a
 * method that loses `@Remote`, gains one, or binds the wrong namespace fails
 * here before the Web client depends on it.
 */

import { describe, expect, it } from 'vitest'
import { remoteMethods } from '@deepseek-ai/dsh-typert-protocol'
import { ProjectsService } from '@medresearch/dsh-plugin-project/src/service.ts'
import { LiteratureService } from '@medresearch/dsh-plugin-literature/src/service.ts'
import { PapersService } from '@medresearch/dsh-plugin-paper/src/service.ts'
import { EvidenceService } from '@medresearch/dsh-plugin-evidence/src/service.ts'
import { DatasetsService } from '@medresearch/dsh-plugin-dataset/src/service.ts'
import { StatisticsService } from '@medresearch/dsh-plugin-statistics/src/service.ts'
import { ArtifactService } from '@medresearch/dsh-plugin-artifact/src/service.ts'
import { KnowledgeService } from '@medresearch/dsh-plugin-knowledge/src/service.ts'
import { SkillsService } from '@medresearch/dsh-plugin-skills/src/service.ts'
import { WritingService } from '@medresearch/dsh-plugin-writing/src/service.ts'

interface Surface {
  readonly service: string
  readonly namespace: string
  readonly methods: readonly string[]
  /** Constructor dependencies are never read while only the binding is inspected. */
  create(): object
}

const surfaces: readonly Surface[] = [{
  service: 'ProjectsService',
  namespace: 'medProjects',
  methods: ['archive', 'create', 'delete', 'get', 'getMode', 'list', 'overview', 'restore', 'savePaper', 'selectProject', 'sessionProject', 'sessions', 'setMode', 'update'],
  create: () => new ProjectsService({} as never),
}, {
  service: 'LiteratureService',
  namespace: 'medLiterature',
  methods: ['approveQuery', 'counterSearch', 'editQuery', 'getPaper', 'listForProject', 'planQuery', 'relatedSearch', 'search', 'unsave'],
  create: () => new LiteratureService({} as never),
}, {
  service: 'PapersService',
  namespace: 'medPapers',
  methods: ['createAnnotation', 'createNote', 'deleteAnnotation', 'deleteNote', 'document', 'focus', 'get', 'getNote', 'listAnnotations', 'listNotes', 'paragraph', 'resolveFulltext', 'search', 'sections', 'summary', 'translate', 'updateNote', 'upload'],
  create: () => new PapersService({} as never),
}, {
  service: 'EvidenceService',
  namespace: 'medEvidence',
  methods: ['chase', 'compare', 'gateClaim', 'listForClaim', 'retrieve', 'save', 'serializeCitations', 'verify', 'withdraw'],
  create: () => new EvidenceService({} as never),
}, {
  service: 'DatasetsService',
  namespace: 'medDatasets',
  methods: ['list', 'preview', 'profile', 'schema', 'upload'],
  create: () => new DatasetsService({} as never),
}, {
  service: 'StatisticsService',
  namespace: 'medStatistics',
  methods: ['approveCode', 'execute', 'generateCode', 'listCharts', 'listRuns', 'plan', 'run'],
  create: () => new StatisticsService({} as never),
}, {
  service: 'ArtifactService',
  namespace: 'medArtifacts',
  methods: ['get'],
  create: () => new ArtifactService({} as never),
}, {
  service: 'KnowledgeService',
  namespace: 'medKnowledge',
  methods: ['createDraft', 'createTag', 'deleteTag', 'getDraft', 'listDrafts', 'listPapers', 'listTags', 'memberships', 'rag', 'renameTag', 'saveDraftRevision', 'search', 'setDraftStatus', 'tag'],
  create: () => new KnowledgeService({} as never),
}, {
  service: 'SkillsService',
  namespace: 'medSkills',
  methods: ['browse', 'cancelTest', 'catalog', 'deleteDraft', 'get', 'install', 'publish', 'revoke', 'saveDraft', 'setEnabled', 'test', 'uninstall', 'upgrade', 'validate'],
  create: () => new SkillsService({} as never),
}, {
  service: 'WritingService',
  namespace: 'medWriting',
  methods: ['export', 'generate', 'translate', 'validate'],
  create: () => new WritingService({} as never),
}]

describe('med Remote surface (SPEC §30)', () => {
  for (const surface of surfaces) {
    it(`${surface.service} binds ${surface.namespace} with its published methods`, () => {
      const service = surface.create()
      expect(Reflect.get(service, 'typertRemote')).toMatchObject({
        serviceKey: surface.namespace,
        namespace: surface.namespace,
      })
      expect(remoteMethods(service).map(marker => marker.method).sort()).toEqual(surface.methods)
    })
  }
})
