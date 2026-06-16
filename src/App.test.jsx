import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import App from './App'

const mockScenario = {
  id: 'test-1',
  name: '测试演练',
  description: '测试描述',
  date: '2026-06-10',
  expectedSlo: '99.9%',
  actualRto: '8 分钟',
  objectives: [
    { id: 'obj1', description: '测试目标', target: '5', actual: '8', achieved: false }
  ],
  participants: [
    { id: 'p1', name: '测试人', role: '开发', department: '技术部', shiftSchedule: '主班', phone: '13800000000', email: 'test@test.com' }
  ],
  issues: [
    {
      id: 'i1',
      title: '测试问题',
      description: '问题描述',
      severity: 'high',
      status: 'todo',
      assigneeId: 'p1',
      dueDate: '2099-06-20',
      rootCause: 'infrastructure',
      createdAt: '2026-06-10T10:30:00Z',
      updatedAt: '2026-06-10T10:30:00Z'
    }
  ],
  actionItems: [
    {
      id: 'a1',
      title: '测试Action',
      description: 'Action描述',
      status: 'pending',
      priority: 'high',
      assigneeId: 'p1',
      issueId: 'i1',
      dueDate: '2099-06-20',
      createdAt: '2026-06-10T14:00:00Z',
      updatedAt: '2026-06-10T14:00:00Z',
      completedAt: null
    }
  ]
}

const defaultInitialData = [
  {
    id: 'demo-1',
    name: '数据库故障应急演练',
    description: '模拟主数据库宕机，验证故障切换流程和数据恢复能力',
    date: '2026-06-10',
    expectedSlo: '99.9% 可用性',
    actualRto: '8 分钟',
    objectives: [
      { id: 'obj1', description: '故障切换时间', target: '5', actual: '8', achieved: false },
      { id: 'obj2', description: '数据零丢失', target: '0', actual: '0', achieved: true }
    ],
    participants: [
      { id: 'p1', name: '张伟', role: '总指挥', department: '运维部', shiftSchedule: '主班 9:00-18:00', phone: '13800138001', email: 'zhangwei@example.com' },
      { id: 'p2', name: '李娜', role: '技术支持', department: 'DBA组', shiftSchedule: '备班 18:00-次日9:00', phone: '13800138002', email: 'lina@example.com' },
      { id: 'p3', name: '王强', role: '开发代表', department: '核心业务组', shiftSchedule: '主班 9:00-18:00', phone: '13800138003', email: 'wangqiang@example.com' }
    ],
    issues: [
      {
        id: 'i1',
        title: '主从切换耗时过长',
        description: '实际切换耗时8分钟，超过预期的3分钟。需要检查切换脚本执行效率。',
        severity: 'high',
        status: 'in_progress',
        assigneeId: 'p2',
        dueDate: '2099-06-20',
        rootCause: 'infrastructure',
        affectedSystems: '核心交易数据库',
        impact: '影响期间约500笔交易',
        resolution: '',
        createdAt: '2026-06-10T10:30:00Z',
        updatedAt: '2026-06-10T10:30:00Z'
      },
      {
        id: 'i2',
        title: '监控告警延迟',
        description: '故障发生后5分钟才收到告警通知，影响响应速度。',
        severity: 'critical',
        status: 'todo',
        assigneeId: 'p1',
        dueDate: '2099-06-18',
        rootCause: 'monitoring',
        affectedSystems: '监控平台',
        impact: '响应时间增加5分钟',
        resolution: '',
        createdAt: '2026-06-10T10:35:00Z',
        updatedAt: '2026-06-10T10:35:00Z'
      },
      {
        id: 'i3',
        title: '回滚预案文档缺失',
        description: '演练过程中发现回滚步骤文档不全，新人无法独立操作。',
        severity: 'medium',
        status: 'resolved',
        assigneeId: 'p3',
        dueDate: '2099-06-15',
        rootCause: 'process',
        affectedSystems: '运维文档系统',
        impact: '',
        resolution: '已补充完整回滚文档，并组织全员培训',
        createdAt: '2026-06-10T11:00:00Z',
        updatedAt: '2026-06-12T15:00:00Z'
      }
    ],
    actionItems: [
      {
        id: 'a1',
        title: '优化数据库切换脚本',
        description: '分析切换脚本性能瓶颈，优化执行逻辑，将切换时间控制在3分钟内',
        status: 'in_progress',
        priority: 'high',
        assigneeId: 'p2',
        issueId: 'i1',
        dueDate: '2099-06-20',
        notes: '需要和架构组确认切换方案',
        createdAt: '2026-06-10T14:00:00Z',
        updatedAt: '2026-06-10T14:00:00Z',
        completedAt: null
      },
      {
        id: 'a2',
        title: '升级告警系统',
        description: '优化告警规则和通知渠道，确保故障在1分钟内触达相关人员',
        status: 'pending',
        priority: 'high',
        assigneeId: 'p1',
        issueId: 'i2',
        dueDate: '2099-06-18',
        notes: '考虑接入短信和电话告警',
        createdAt: '2026-06-10T14:30:00Z',
        updatedAt: '2026-06-10T14:30:00Z',
        completedAt: null
      },
      {
        id: 'a3',
        title: '组织回滚流程培训',
        description: '组织所有运维人员进行回滚流程培训，确保每人都能独立操作',
        status: 'completed',
        priority: 'medium',
        assigneeId: 'p3',
        issueId: 'i3',
        dueDate: '2099-06-15',
        notes: '已完成培训，共12人参与',
        createdAt: '2026-06-10T15:00:00Z',
        updatedAt: '2026-06-12T16:00:00Z',
        completedAt: '2026-06-12T16:00:00Z'
      }
    ]
  }
]

describe('App Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    localStorage.getItem.mockReturnValue(JSON.stringify(defaultInitialData))
  })

  describe('Initial Render', () => {
    it('should render with initial demo data', () => {
      render(<App />)
      expect(screen.getAllByText('数据库故障应急演练').length).toBeGreaterThan(0)
    })

    it('should display scenario details', () => {
      render(<App />)
      expect(screen.getByText(/预期 SLO/)).toBeInTheDocument()
      expect(screen.getByText(/实际 RTO/)).toBeInTheDocument()
    })

    it('should display objectives section', () => {
      render(<App />)
      expect(screen.getByText(/演练目标/)).toBeInTheDocument()
    })

    it('should display participants panel', () => {
      render(<App />)
      expect(screen.getByText(/参演人员/)).toBeInTheDocument()
    })

    it('should display tabs', () => {
      render(<App />)
      expect(screen.getByText('问题看板')).toBeInTheDocument()
      expect(screen.getByText('Action Items')).toBeInTheDocument()
      expect(screen.getByText('时间轴')).toBeInTheDocument()
      expect(screen.getByText('依赖图')).toBeInTheDocument()
    })
  })

  describe('Issue Management', () => {
    it('should display issues in kanban columns', () => {
      render(<App />)
      expect(screen.getByText('主从切换耗时过长')).toBeInTheDocument()
      expect(screen.getByText('监控告警延迟')).toBeInTheDocument()
      expect(screen.getByText('回滚预案文档缺失')).toBeInTheDocument()
    })

    it('should display issue severity badges', () => {
      render(<App />)
      expect(screen.getByText('高危')).toBeInTheDocument()
      expect(screen.getByText('致命')).toBeInTheDocument()
      expect(screen.getByText('中危')).toBeInTheDocument()
    })

    it('should display issue root cause badges', () => {
      render(<App />)
      expect(screen.getByText('基础设施')).toBeInTheDocument()
      expect(screen.getByText('监控告警')).toBeInTheDocument()
      expect(screen.getByText('流程缺陷')).toBeInTheDocument()
    })

    it('should display issue assignees', () => {
      render(<App />)
      expect(screen.getByText('👤 李娜')).toBeInTheDocument()
      expect(screen.getByText('👤 张伟')).toBeInTheDocument()
      expect(screen.getByText('👤 王强')).toBeInTheDocument()
    })

    it('should display issue due dates', () => {
      render(<App />)
      const dueDates = screen.getAllByText(/📅/)
      expect(dueDates.length).toBeGreaterThan(0)
    })
  })

  describe('Participant Management', () => {
    it('should display participant roles', () => {
      render(<App />)
      expect(screen.getByText('总指挥')).toBeInTheDocument()
      expect(screen.getByText('技术支持')).toBeInTheDocument()
      expect(screen.getByText('开发代表')).toBeInTheDocument()
    })

    it('should display participant shift schedules', () => {
      render(<App />)
      expect(screen.getAllByText(/主班 9:00-18:00/).length).toBeGreaterThan(0)
      expect(screen.getByText(/备班 18:00-次日9:00/)).toBeInTheDocument()
    })

    it('should display participant contact info', () => {
      render(<App />)
      const phones = screen.getAllByText(/📱/)
      const emails = screen.getAllByText(/📧/)
      expect(phones.length).toBe(3)
      expect(emails.length).toBe(3)
    })
  })

  describe('Action Items Management', () => {
    it('should switch to Action Items tab', async () => {
      render(<App />)
      fireEvent.click(screen.getByText('Action Items'))
      await waitFor(() => {
        expect(screen.getAllByText(/Action Items/).length).toBeGreaterThan(0)
      })
    })

    it('should display action item status columns', async () => {
      render(<App />)
      fireEvent.click(screen.getByText('Action Items'))
      await waitFor(() => {
        expect(screen.getAllByText('待开始').length).toBeGreaterThan(0)
        expect(screen.getAllByText('进行中').length).toBeGreaterThan(0)
        expect(screen.getAllByText('已完成').length).toBeGreaterThan(0)
        expect(screen.getByText('已验证')).toBeInTheDocument()
      })
    })

    it('should display completion rate', async () => {
      render(<App />)
      fireEvent.click(screen.getByText('Action Items'))
      await waitFor(() => {
        expect(screen.getByText(/完成率:/)).toBeInTheDocument()
      })
    })
  })

  describe('Tab Switching', () => {
    it('should switch to timeline tab', async () => {
      render(<App />)
      fireEvent.click(screen.getByText('时间轴'))
      await waitFor(() => {
        expect(screen.getByText('演练开始')).toBeInTheDocument()
      })
    })

    it('should switch to dependency graph tab', async () => {
      render(<App />)
      fireEvent.click(screen.getByText('依赖图'))
      await waitFor(() => {
        expect(screen.getAllByText('演练场景').length).toBeGreaterThan(1)
      })
    })

    it('should switch back to kanban tab', async () => {
      render(<App />)
      fireEvent.click(screen.getByText('时间轴'))
      fireEvent.click(screen.getByText('问题看板'))
      await waitFor(() => {
        expect(screen.getAllByText('待处理').length).toBeGreaterThan(0)
      })
    })
  })

  describe('Sync and Export', () => {
    it('should display sync button', async () => {
      render(<App />)
      await waitFor(() => {
        const btns = screen.getAllByText(/同步|离线|重试/)
        expect(btns.length).toBeGreaterThan(0)
      }, { timeout: 3000 })
    })

    it('should display export button', () => {
      render(<App />)
      expect(screen.getByText(/导出报告/)).toBeInTheDocument()
    })

    it('should display stats bar', () => {
      render(<App />)
      expect(screen.getByText('总计')).toBeInTheDocument()
      expect(screen.getAllByText('待处理').length).toBeGreaterThan(0)
      expect(screen.getAllByText('处理中').length).toBeGreaterThan(0)
      expect(screen.getAllByText('已解决').length).toBeGreaterThan(0)
    })
  })

  describe('Scenario Sidebar', () => {
    it('should display scenario list', () => {
      render(<App />)
      expect(screen.getByText('演练场景')).toBeInTheDocument()
    })

    it('should display active scenario', () => {
      render(<App />)
      const scenarioItems = screen.getAllByText('数据库故障应急演练')
      const activeScenario = scenarioItems[0].closest('.scenario-item')
      expect(activeScenario).toHaveClass('active')
    })
  })
})

describe('CRUD Operations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  describe('Add Operations', () => {
    it('should show add scenario button', () => {
      render(<App />)
      const addButtons = screen.getAllByText('+')
      expect(addButtons.length).toBeGreaterThan(0)
    })

    it('should show add participant button', () => {
      render(<App />)
      expect(screen.getByText('+ 添加')).toBeInTheDocument()
    })

    it('should show add issue buttons in kanban columns', () => {
      render(<App />)
      const addIssueButtons = screen.getAllByTitle('添加问题')
      expect(addIssueButtons.length).toBe(3)
    })
  })

  describe('Edit Operations', () => {
    it('should show edit buttons on hover for issues', () => {
      render(<App />)
      const editButtons = screen.getAllByTitle('编辑')
      expect(editButtons.length).toBeGreaterThan(0)
    })

    it('should show delete buttons on hover for issues', () => {
      render(<App />)
      const deleteButtons = screen.getAllByTitle('删除')
      expect(deleteButtons.length).toBeGreaterThan(0)
    })
  })

  describe('Data Persistence', () => {
    it('should load data from localStorage on mount', async () => {
      const mockData = [mockScenario]
      localStorage.getItem.mockReturnValue(JSON.stringify(mockData))

      render(<App />)

      await waitFor(() => {
        expect(localStorage.getItem).toHaveBeenCalled()
        const matches = screen.queryAllByText('测试演练')
        expect(matches.length).toBeGreaterThan(0)
      }, { timeout: 3000 })
    })

    it('should save data to localStorage when changed', async () => {
      render(<App />)

      await waitFor(() => {
        expect(localStorage.setItem).toHaveBeenCalled()
      }, { timeout: 3000 })
    })
  })
})

describe('State Transitions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    const initialData = [
      {
        id: 'demo-1',
        name: '数据库故障应急演练',
        description: '模拟主数据库宕机',
        date: '2026-06-10',
        expectedSlo: '99.9% 可用性',
        actualRto: '8 分钟',
        objectives: [
          { id: 'obj1', description: '故障切换时间', target: '5', actual: '8', achieved: false },
          { id: 'obj2', description: '数据零丢失', target: '0', actual: '0', achieved: true }
        ],
        participants: [
          { id: 'p1', name: '张伟', role: '总指挥', department: '运维部', shiftSchedule: '主班', phone: '13800138001', email: 'zhangwei@example.com' },
          { id: 'p2', name: '李娜', role: '技术支持', department: 'DBA组', shiftSchedule: '备班', phone: '13800138002', email: 'lina@example.com' }
        ],
        issues: [
          {
            id: 'i1',
            title: '主从切换耗时过长',
            description: '实际切换耗时8分钟',
            severity: 'high',
            status: 'in_progress',
            assigneeId: 'p2',
            dueDate: '2099-06-20',
            rootCause: 'infrastructure',
            affectedSystems: '核心交易数据库',
            impact: '影响期间约500笔交易',
            resolution: '',
            createdAt: '2026-06-10T10:30:00Z',
            updatedAt: '2026-06-10T10:30:00Z'
          },
          {
            id: 'i2',
            title: '监控告警延迟',
            description: '故障发生后5分钟才收到告警',
            severity: 'critical',
            status: 'todo',
            assigneeId: 'p1',
            dueDate: '2099-06-18',
            rootCause: 'monitoring',
            affectedSystems: '监控平台',
            impact: '响应时间增加5分钟',
            resolution: '',
            createdAt: '2026-06-10T10:35:00Z',
            updatedAt: '2026-06-10T10:35:00Z'
          },
          {
            id: 'i3',
            title: '回滚预案文档缺失',
            description: '演练过程中发现回滚步骤文档不全',
            severity: 'medium',
            status: 'resolved',
            assigneeId: 'p2',
            dueDate: '2099-06-15',
            rootCause: 'process',
            affectedSystems: '运维文档系统',
            impact: '',
            resolution: '已补充完整回滚文档，并组织全员培训',
            createdAt: '2026-06-10T11:00:00Z',
            updatedAt: '2026-06-12T15:00:00Z'
          }
        ],
        actionItems: [
          {
            id: 'a1',
            title: '优化数据库切换脚本',
            description: '分析切换脚本性能瓶颈',
            status: 'in_progress',
            priority: 'high',
            assigneeId: 'p2',
            issueId: 'i1',
            dueDate: '2099-06-20',
            notes: '',
            createdAt: '2026-06-10T14:00:00Z',
            updatedAt: '2026-06-10T14:00:00Z',
            completedAt: null
          },
          {
            id: 'a2',
            title: '升级告警系统',
            description: '优化告警规则和通知渠道',
            status: 'pending',
            priority: 'high',
            assigneeId: 'p1',
            issueId: 'i2',
            dueDate: '2099-06-18',
            notes: '',
            createdAt: '2026-06-10T14:30:00Z',
            updatedAt: '2026-06-10T14:30:00Z',
            completedAt: null
          }
        ]
      }
    ]
    localStorage.getItem.mockReturnValue(JSON.stringify(initialData))
  })

  it('should display correct status colors for issues', () => {
    render(<App />)

    const kanbanColumns = document.querySelectorAll('.kanban-column')
    expect(kanbanColumns.length).toBe(3)
    
    const columnHeaders = Array.from(kanbanColumns).map(col => 
      col.querySelector('.column-title h3')?.textContent
    )
    
    expect(columnHeaders).toContain('待处理')
    expect(columnHeaders).toContain('处理中')
    expect(columnHeaders).toContain('已解决')
  })

  it('should display resolution for resolved issues', () => {
    render(<App />)
    expect(screen.getByText(/解决方案:/)).toBeInTheDocument()
  })

  it('should display achievement badges for objectives', () => {
    render(<App />)
    const achievedBadges = screen.getAllByText((content, element) => {
      return element.tagName.toLowerCase() === 'span' && 
             element.classList.contains('achievement-badge') && 
             content.includes('已达成')
    })
    const notAchievedBadges = screen.getAllByText((content, element) => {
      return element.tagName.toLowerCase() === 'span' && 
             element.classList.contains('achievement-badge') && 
             content.includes('未达成')
    })
    expect(achievedBadges.length).toBeGreaterThan(0)
    expect(notAchievedBadges.length).toBeGreaterThan(0)
  })
})
