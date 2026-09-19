// @vitest-environment jsdom
/**
 * The 0917 page-shell primitives (R001 `ui-acceptance.md` 的"页头三件套 + 页内页签 +
 * 比例分栏 + 计数卡"). These are presentation-only, so the assertions are about
 * what the region tables in `scripts/ui-parity-regions.mjs` will look for: the
 * crumb/heading/badge/meta/action row, a selectable segment control that is not
 * a host View tab, a ratio token the stylesheet can key off, and a counter that
 * never invents a number it was not given.
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import {
  MedBreadcrumb, MedMetricTile, MedPageHeader, MedPageTabs, MedSplit, MedViewFrame,
} from '../src/client/components.tsx'
import { en } from '../src/i18n/index.ts'

afterEach(cleanup)

const t = (key: keyof typeof en): string => en[key]

describe('MedPageHeader', () => {
  it('renders the crumb, heading, badge, description, meta row and actions together', () => {
    render(createElement(MedPageHeader, {
      crumb: createElement('nav', { 'aria-label': 'crumb' }, 'PONV 研究 › 证据与笔记'),
      title: 'PONV 研究',
      status: { label: '进行中', tone: 'active' },
      description: '地塞米松预防术后恶心呕吐的有效性',
      meta: createElement('span', null, '张医生（负责人）'),
      actions: createElement('button', { type: 'button' }, '分享'),
    }))
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('PONV 研究')
    expect(screen.getByRole('navigation', { name: 'crumb' })).toBeTruthy()
    expect(screen.getByText('进行中').getAttribute('data-status')).toBe('active')
    expect(screen.getByText('地塞米松预防术后恶心呕吐的有效性')).toBeTruthy()
    expect(screen.getByText('张医生（负责人）')).toBeTruthy()
    expect(screen.getByRole('button', { name: '分享' })).toBeTruthy()
  })

  it('omits every optional region it was not given, and marks the display-scale heading', () => {
    const { container } = render(createElement(MedPageHeader, { title: '统计', display: true }))
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('统计')
    expect(container.querySelector('.medStatusBadge')).toBeNull()
    expect(container.querySelector('.medPageDescription')).toBeNull()
    expect(container.querySelector('.medPageMeta')).toBeNull()
    expect(container.querySelector('.medPageActions')).toBeNull()
    expect(container.querySelector('.medPageHeader')?.getAttribute('data-display')).toBe('true')
  })
})

describe('MedPageTabs', () => {
  const tabs = [
    { id: 'evidence', label: '证据', count: 36 },
    { id: 'note', label: '笔记', count: 12 },
  ] as const

  it('marks the selected segment and reports a click on another', () => {
    const onChange = vi.fn()
    render(createElement(MedPageTabs<'evidence' | 'note'>, {
      tabs, value: 'evidence', onChange, label: '证据与笔记',
    }))
    const list = screen.getByRole('tablist', { name: '证据与笔记' })
    expect(list.getAttribute('class')).toContain('medPageTabs')
    const [first, second] = screen.getAllByRole('tab')
    expect(first?.getAttribute('aria-selected')).toBe('true')
    expect(first?.textContent).toBe('证据36')
    expect(second?.getAttribute('aria-selected')).toBe('false')
    fireEvent.click(second as HTMLElement)
    expect(onChange).toHaveBeenCalledWith('note')
  })

  it('renders no count chip for a segment the service did not count', () => {
    render(createElement(MedPageTabs<'plain'>, {
      tabs: [{ id: 'plain', label: '概览' }], value: 'plain', onChange: () => {}, label: '页内页签',
    }))
    expect(screen.getByRole('tab').textContent).toBe('概览')
  })
})

describe('MedSplit', () => {
  it('carries the prototype ratio as a token the stylesheet keys off', () => {
    render(createElement(MedSplit, {
      children: [
        createElement('div', { key: 'toc' }, '目录'),
        createElement('div', { key: 'body' }, '正文'),
        createElement('div', { key: 'side' }, '助手'),
      ],
      label: '正文与助手',
      ratio: '14-48-38',
    }))
    const group = screen.getByRole('group', { name: '正文与助手' })
    expect(group.getAttribute('data-ratio')).toBe('14-48-38')
    expect(group.children).toHaveLength(3)
  })
})

describe('MedMetricTile', () => {
  it('renders the delta and the note when the service reports them', () => {
    render(createElement(MedMetricTile, {
      delta: { label: '↑12', tone: 'up' },
      icon: createElement('span', null, '·'),
      label: '文献数量',
      note: '累计添加',
      onOpen: () => {},
      tone: 'blue',
      value: '36',
    }))
    expect(screen.getByText('36')).toBeTruthy()
    expect(screen.getByText('↑12').getAttribute('data-tone')).toBe('up')
    expect(screen.getByText('累计添加')).toBeTruthy()
    expect(screen.getByRole('button', { name: /文献数量/u })).toBeTruthy()
  })

  it('renders neither delta nor note when nobody reported one', () => {
    const { container } = render(createElement(MedMetricTile, {
      icon: createElement('span', null, '·'),
      label: '数据集数量',
      tone: 'purple',
      value: '未知',
    }))
    expect(container.querySelector('.medTileDelta')).toBeNull()
    expect(container.querySelector('.medTileNote')).toBeNull()
    expect(container.querySelector('.medTile')?.getAttribute('data-disabled')).toBe('true')
  })

  it('offers retry instead of navigation for a domain that failed to read', () => {
    const onRetry = vi.fn()
    render(createElement(MedMetricTile, {
      disabledLabel: '读取失败',
      icon: createElement('span', null, '·'),
      label: '证据数量',
      onRetry,
      retryLabel: '重试',
      tone: 'green',
      value: '未知',
    }))
    fireEvent.click(screen.getByRole('button', { name: '重试' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('button', { name: /证据数量/u })).toBeNull()
  })
})

describe('MedViewFrame', () => {
  it('puts the crumb inside the page header rather than the body', () => {
    const { container } = render(createElement(MedViewFrame, {
      children: createElement('p', null, '正文'),
      crumb: createElement(MedBreadcrumb, { page: '统计', project: 'PONV 研究', t }),
      state: 'READY',
      title: '统计',
    }))
    const header = container.querySelector('.medPageHeader')
    expect(header?.querySelector('.medCrumb')).not.toBeNull()
    expect(header?.querySelector('.medCrumb .medCrumbPage')?.textContent).toBe('统计')
    expect(header?.querySelector('.medStatusBadge')?.textContent).toBe('READY')
    // The header carries the crumb and the badge; the page body stays outside it.
    expect(header?.textContent).toBe('PONV 研究›统计统计READY')
    expect(header?.querySelector('p')).toBeNull()
  })
})
