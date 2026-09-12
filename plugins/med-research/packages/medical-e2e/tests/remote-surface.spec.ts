/**
 * The complete Remote surface of the seven med services (SPEC §30). The test
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
  methods: ['create', 'delete', 'get', 'getMode', 'list', 'overview', 'savePaper', 'setMode', 'update'],
  create: () => new ProjectsService({} as never),
}, {
  service: 'LiteratureService',
  namespace: 'medLiterature',
  methods: ['approveQuery', 'counterSearch', 'editQuery', 'getPaper', 'planQuery', 'relatedSearch', 'search'],
  create: () => new LiteratureService({} as never),
}, {
  service: 'PapersService',
  namespace: 'medPapers',
  methods: ['document', 'get', 'paragraph', 'resolveFulltext', 'search', 'sections', 'upload'],
  create: () => new PapersService({} as never),
}, {
  service: 'EvidenceService',
  namespace: 'medEvidence',
  methods: ['listForClaim', 'retrieve', 'save', 'verify'],
  create: () => new EvidenceService({} as never),
}, {
  service: 'DatasetsService',
  namespace: 'medDatasets',
  methods: ['profile', 'schema', 'upload'],
  create: () => new DatasetsService({} as never),
}, {
  service: 'StatisticsService',
  namespace: 'medStatistics',
  methods: ['execute', 'generateCode', 'plan'],
  create: () => new StatisticsService({} as never),
}, {
  service: 'ArtifactService',
  namespace: 'medArtifacts',
  methods: ['get'],
  create: () => new ArtifactService({} as never),
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
