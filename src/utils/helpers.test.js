import { describe, it, expect, beforeEach } from 'vitest'
import {
  generateId,
  formatDate,
  formatDateTime,
  severityColors,
  statusConfig,
  actionItemStatusConfig,
  rootCauseCategories,
  getRootCauseCategory,
  isOverdue,
  getDaysUntilDue,
  calculateRto,
  generateTimelineEvents,
  generateDependencyGraph,
  exportMarkdownReport
} from './helpers'

describe('helpers utility functions', () => {
  describe('generateId', () => {
    it('should generate unique IDs', () => {
      const id1 = generateId()
      const id2 = generateId()
      expect(id1).not.toBe(id2)
      expect(typeof id1).toBe('string')
      expect(id1.length).toBeGreaterThan(5)
    })
  })

  describe('formatDate', () => {
    it('should format date string correctly', () => {
      const date = formatDate('2026-06-10')
      expect(date).toMatch(/2026.*06.*10/)
    })

    it('should return empty string for null/undefined', () => {
      expect(formatDate(null)).toBe('')
      expect(formatDate(undefined)).toBe('')
    })
  })

  describe('formatDateTime', () => {
    it('should format datetime string correctly', () => {
      const dateTime = formatDateTime('2026-06-10T10:30:00Z')
      expect(dateTime).toMatch(/2026.*06.*10/)
      expect(dateTime).toMatch(/\d{2}:\d{2}/)
    })

    it('should return empty string for null/undefined', () => {
      expect(formatDateTime(null)).toBe('')
      expect(formatDateTime(undefined)).toBe('')
    })
  })

  describe('severityColors', () => {
    it('should have all severity levels', () => {
      expect(severityColors).toHaveProperty('critical')
      expect(severityColors).toHaveProperty('high')
      expect(severityColors).toHaveProperty('medium')
      expect(severityColors).toHaveProperty('low')
    })

    it('should have correct structure for each severity', () => {
      Object.values(severityColors).forEach((severity) => {
        expect(severity).toHaveProperty('bg')
        expect(severity).toHaveProperty('text')
        expect(severity).toHaveProperty('label')
      })
    })
  })

  describe('statusConfig', () => {
    it('should have all issue statuses', () => {
      expect(statusConfig).toHaveProperty('todo')
      expect(statusConfig).toHaveProperty('in_progress')
      expect(statusConfig).toHaveProperty('resolved')
    })
  })

  describe('actionItemStatusConfig', () => {
    it('should have all action item statuses', () => {
      expect(actionItemStatusConfig).toHaveProperty('pending')
      expect(actionItemStatusConfig).toHaveProperty('in_progress')
      expect(actionItemStatusConfig).toHaveProperty('blocked')
      expect(actionItemStatusConfig).toHaveProperty('completed')
      expect(actionItemStatusConfig).toHaveProperty('verified')
    })
  })

  describe('rootCauseCategories', () => {
    it('should have root cause categories', () => {
      expect(rootCauseCategories.length).toBeGreaterThan(0)
      rootCauseCategories.forEach((cat) => {
        expect(cat).toHaveProperty('id')
        expect(cat).toHaveProperty('label')
        expect(cat).toHaveProperty('color')
      })
    })
  })

  describe('getRootCauseCategory', () => {
    it('should return correct category for valid ID', () => {
      const cat = getRootCauseCategory('infrastructure')
      expect(cat.label).toBe('基础设施')
    })

    it('should return "其他" for invalid ID', () => {
      const cat = getRootCauseCategory('invalid-id')
      expect(cat.label).toBe('其他')
    })
  })

  describe('isOverdue', () => {
    it('should return true for past dates', () => {
      expect(isOverdue('2020-01-01')).toBe(true)
    })

    it('should return false for future dates', () => {
      expect(isOverdue('2099-01-01')).toBe(false)
    })

    it('should return false for null/undefined', () => {
      expect(isOverdue(null)).toBe(false)
      expect(isOverdue(undefined)).toBe(false)
    })
  })

  describe('getDaysUntilDue', () => {
    it('should return negative days for past dates', () => {
      const days = getDaysUntilDue('2020-01-01')
      expect(days).toBeLessThan(0)
    })

    it('should return positive days for future dates', () => {
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 5)
      const days = getDaysUntilDue(futureDate.toISOString())
      expect(days).toBe(5)
    })

    it('should return null for null/undefined', () => {
      expect(getDaysUntilDue(null)).toBeNull()
      expect(getDaysUntilDue(undefined)).toBeNull()
    })
  })

  describe('calculateRto', () => {
    it('should calculate RTO in minutes', () => {
      const rto = calculateRto('2026-06-10T10:00:00Z', '2026-06-10T10:08:00Z')
      expect(rto).toBe('8 分钟')
    })

    it('should calculate RTO in hours and minutes', () => {
      const rto = calculateRto('2026-06-10T10:00:00Z', '2026-06-10T12:30:00Z')
      expect(rto).toBe('2 小时 30 分钟')
    })

    it('should return null for missing dates', () => {
      expect(calculateRto(null, '2026-06-10T10:00:00Z')).toBeNull()
      expect(calculateRto('2026-06-10T10:00:00Z', null)).toBeNull()
    })
  })

  const mockScenario = {
    id: 'test-1',
    name: '测试演练',
    date: '2026-06-10',
    expectedSlo: '99.9%',
    actualRto: '8 分钟',
    objectives: [
      { id: 'obj1', description: '测试目标', target: '5', actual: '8', achieved: false }
    ],
    participants: [
      { id: 'p1', name: '测试人', role: '测试员', department: '测试部', shiftSchedule: '主班' }
    ],
    issues: [
      {
        id: 'i1',
        title: '测试问题',
        description: '测试描述',
        severity: 'high',
        status: 'in_progress',
        assigneeId: 'p1',
        dueDate: '2026-06-20',
        rootCause: 'infrastructure',
        createdAt: '2026-06-10T10:30:00Z',
        updatedAt: '2026-06-10T10:30:00Z'
      }
    ],
    actionItems: [
      {
        id: 'a1',
        title: '测试Action',
        description: '测试描述',
        status: 'in_progress',
        priority: 'high',
        assigneeId: 'p1',
        issueId: 'i1',
        dueDate: '2026-06-20',
        createdAt: '2026-06-10T14:00:00Z',
        completedAt: null
      }
    ]
  }

  describe('generateTimelineEvents', () => {
    it('should generate timeline events from scenario', () => {
      const events = generateTimelineEvents(mockScenario)
      expect(events.length).toBeGreaterThan(0)
      expect(events[0].type).toBe('milestone')
      expect(events[0].title).toBe('演练开始')
    })

    it('should sort events chronologically', () => {
      const events = generateTimelineEvents(mockScenario)
      for (let i = 1; i < events.length; i++) {
        expect(new Date(events[i].time).getTime()).toBeGreaterThanOrEqual(
          new Date(events[i - 1].time).getTime()
        )
      }
    })
  })

  describe('generateDependencyGraph', () => {
    it('should generate nodes and links', () => {
      const { nodes, links } = generateDependencyGraph(mockScenario)
      expect(nodes.length).toBeGreaterThan(0)
      expect(links.length).toBeGreaterThan(0)
    })

    it('should have scenario node', () => {
      const { nodes } = generateDependencyGraph(mockScenario)
      const scenarioNode = nodes.find((n) => n.type === 'scenario')
      expect(scenarioNode).toBeDefined()
      expect(scenarioNode.label).toBe('演练场景')
    })

    it('should have participant, issue, and action nodes', () => {
      const { nodes } = generateDependencyGraph(mockScenario)
      expect(nodes.some((n) => n.type === 'participant')).toBe(true)
      expect(nodes.some((n) => n.type === 'issue')).toBe(true)
      expect(nodes.some((n) => n.type === 'action')).toBe(true)
    })
  })

  describe('exportMarkdownReport', () => {
    it('should generate markdown report', () => {
      const markdown = exportMarkdownReport(mockScenario)
      expect(markdown).toContain('# 应急演练复盘报告')
      expect(markdown).toContain('测试演练')
      expect(markdown).toContain('## 参演人员')
      expect(markdown).toContain('## 问题统计')
      expect(markdown).toContain('## Action Items')
    })

    it('should include objectives section if present', () => {
      const markdown = exportMarkdownReport(mockScenario)
      expect(markdown).toContain('## 演练目标')
      expect(markdown).toContain('测试目标')
    })

    it('should include SLO and RTO section if present', () => {
      const markdown = exportMarkdownReport(mockScenario)
      expect(markdown).toContain('## SLO 与 RTO')
      expect(markdown).toContain('99.9%')
      expect(markdown).toContain('8 分钟')
    })

    it('should include root cause analysis if present', () => {
      const markdown = exportMarkdownReport(mockScenario)
      expect(markdown).toContain('## 根因分析')
      expect(markdown).toContain('基础设施')
    })
  })
})
