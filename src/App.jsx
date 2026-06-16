import { useState, useEffect, useCallback } from 'react'
import { saveToStorage, loadFromStorage } from './utils/storage'
import { syncService, syncStatus, useSync } from './utils/syncApi'
import {
  formatDate,
  formatDateTime,
  exportMarkdownReport,
  downloadFile
} from './utils/helpers'
import ScenarioSidebar from './components/ScenarioSidebar'
import ParticipantsPanel from './components/ParticipantsPanel'
import KanbanColumn from './components/KanbanColumn'
import ActionItemsPanel from './components/ActionItemsPanel'
import Timeline from './components/Timeline'
import DependencyGraph from './components/DependencyGraph'
import Modal from './components/Modal'
import ScenarioForm from './components/ScenarioForm'
import ParticipantForm from './components/ParticipantForm'
import IssueForm from './components/IssueForm'
import ActionItemForm from './components/ActionItemForm'
import './App.css'

const initialData = [
  {
    id: 'demo-1',
    name: '数据库故障应急演练',
    description: '模拟主数据库宕机，验证故障切换流程和数据恢复能力',
    date: '2026-06-10',
    expectedSlo: '99.9% 可用性',
    actualRto: '8 分钟',
    objectives: [
      {
        id: 'obj1',
        description: '故障切换时间',
        target: '5',
        actual: '8',
        achieved: false
      },
      {
        id: 'obj2',
        description: '数据零丢失',
        target: '0',
        actual: '0',
        achieved: true
      }
    ],
    participants: [
      {
        id: 'p1',
        name: '张伟',
        role: '总指挥',
        department: '运维部',
        shiftSchedule: '主班 9:00-18:00',
        phone: '13800138001',
        email: 'zhangwei@example.com'
      },
      {
        id: 'p2',
        name: '李娜',
        role: '技术支持',
        department: 'DBA组',
        shiftSchedule: '备班 18:00-次日9:00',
        phone: '13800138002',
        email: 'lina@example.com'
      },
      {
        id: 'p3',
        name: '王强',
        role: '开发代表',
        department: '核心业务组',
        shiftSchedule: '主班 9:00-18:00',
        phone: '13800138003',
        email: 'wangqiang@example.com'
      }
    ],
    issues: [
      {
        id: 'i1',
        title: '主从切换耗时过长',
        description: '实际切换耗时8分钟，超过预期的3分钟。需要检查切换脚本执行效率。',
        severity: 'high',
        status: 'in_progress',
        assigneeId: 'p2',
        dueDate: '2026-06-20',
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
        dueDate: '2026-06-18',
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
        dueDate: '2026-06-15',
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
        dueDate: '2026-06-20',
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
        dueDate: '2026-06-18',
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
        dueDate: '2026-06-15',
        notes: '已完成培训，共12人参与',
        createdAt: '2026-06-10T15:00:00Z',
        updatedAt: '2026-06-12T16:00:00Z',
        completedAt: '2026-06-12T16:00:00Z'
      }
    ]
  }
]

const tabs = [
  { id: 'kanban', label: '问题看板', icon: '📋' },
  { id: 'actions', label: 'Action Items', icon: '✅' },
  { id: 'timeline', label: '时间轴', icon: '⏱️' },
  { id: 'graph', label: '依赖图', icon: '🔗' }
]

function App() {
  const [scenarios, setScenarios] = useState(() => {
    const saved = loadFromStorage()
    return saved && saved.length > 0 ? saved : initialData
  })
  const [activeScenarioId, setActiveScenarioId] = useState(() => {
    const saved = loadFromStorage()
    return saved && saved.length > 0 ? saved[0].id : initialData[0].id
  })
  const [draggedIssue, setDraggedIssue] = useState(null)
  const [activeTab, setActiveTab] = useState('kanban')

  const [syncState, setSyncState] = useState(syncService.getStatus())
  const [isSyncing, setIsSyncing] = useState(false)

  const [modalState, setModalState] = useState({
    scenario: { isOpen: false, data: null },
    participant: { isOpen: false, data: null },
    issue: { isOpen: false, data: null, defaultStatus: 'todo' },
    actionItem: { isOpen: false, data: null, defaultStatus: 'pending' }
  })

  useEffect(() => {
    return syncService.subscribe(setSyncState)
  }, [])

  useEffect(() => {
    if (scenarios.length > 0) {
      saveToStorage(scenarios)
    }
  }, [scenarios])

  useEffect(() => {
    let syncTimeout
    const scheduleSync = () => {
      syncTimeout = setTimeout(async () => {
        if (scenarios.length > 0) {
          setIsSyncing(true)
          await syncService.push(scenarios)
          setIsSyncing(false)
        }
        scheduleSync()
      }, 30000)
    }
    scheduleSync()
    return () => clearTimeout(syncTimeout)
  }, [scenarios])

  const activeScenario = scenarios.find((s) => s.id === activeScenarioId)

  const updateScenario = useCallback((scenarioId, updater) => {
    setScenarios((prev) =>
      prev.map((s) => (s.id === scenarioId ? updater(s) : s))
    )
  }, [])

  const handleSyncNow = async () => {
    if (scenarios.length > 0) {
      setIsSyncing(true)
      await syncService.push(scenarios)
      setIsSyncing(false)
    }
  }

  const handleExportReport = () => {
    if (!activeScenario) return
    const markdown = exportMarkdownReport(activeScenario)
    const filename = `演练复盘-${activeScenario.name}-${new Date().toISOString().split('T')[0]}.md`
    downloadFile(markdown, filename, 'text/markdown;charset=utf-8')
  }

  const handleAddScenario = () => {
    setModalState({ ...modalState, scenario: { isOpen: true, data: null } })
  }

  const handleEditScenario = (scenario) => {
    setModalState({ ...modalState, scenario: { isOpen: true, data: scenario } })
  }

  const handleSaveScenario = (scenarioData) => {
    if (modalState.scenario.data) {
      setScenarios((prev) =>
        prev.map((s) => (s.id === scenarioData.id ? scenarioData : s))
      )
    } else {
      setScenarios((prev) => [...prev, scenarioData])
      setActiveScenarioId(scenarioData.id)
    }
    setModalState({ ...modalState, scenario: { isOpen: false, data: null } })
  }

  const handleDeleteScenario = (scenarioId) => {
    setScenarios((prev) => prev.filter((s) => s.id !== scenarioId))
    if (activeScenarioId === scenarioId) {
      const remaining = scenarios.filter((s) => s.id !== scenarioId)
      setActiveScenarioId(remaining.length > 0 ? remaining[0].id : null)
    }
  }

  const handleAddParticipant = () => {
    setModalState({ ...modalState, participant: { isOpen: true, data: null } })
  }

  const handleEditParticipant = (participant) => {
    setModalState({ ...modalState, participant: { isOpen: true, data: participant } })
  }

  const handleSaveParticipant = (participantData) => {
    updateScenario(activeScenarioId, (scenario) => {
      if (modalState.participant.data) {
        return {
          ...scenario,
          participants: scenario.participants.map((p) =>
            p.id === participantData.id ? participantData : p
          )
        }
      } else {
        return {
          ...scenario,
          participants: [...scenario.participants, participantData]
        }
      }
    })
    setModalState({ ...modalState, participant: { isOpen: false, data: null } })
  }

  const handleDeleteParticipant = (participantId) => {
    updateScenario(activeScenarioId, (scenario) => ({
      ...scenario,
      participants: scenario.participants.filter((p) => p.id !== participantId),
      issues: scenario.issues.map((issue) =>
        issue.assigneeId === participantId
          ? { ...issue, assigneeId: '' }
          : issue
      ),
      actionItems: scenario.actionItems.map((action) =>
        action.assigneeId === participantId
          ? { ...action, assigneeId: '' }
          : action
      )
    }))
  }

  const handleAddIssue = (status = 'todo') => {
    setModalState({
      ...modalState,
      issue: { isOpen: true, data: null, defaultStatus: status }
    })
  }

  const handleEditIssue = (issue) => {
    setModalState({
      ...modalState,
      issue: { isOpen: true, data: issue, defaultStatus: issue.status }
    })
  }

  const handleSaveIssue = (issueData) => {
    updateScenario(activeScenarioId, (scenario) => {
      if (modalState.issue.data) {
        return {
          ...scenario,
          issues: scenario.issues.map((i) =>
            i.id === issueData.id ? issueData : i
          )
        }
      } else {
        return {
          ...scenario,
          issues: [...scenario.issues, issueData]
        }
      }
    })
    setModalState({
      ...modalState,
      issue: { isOpen: false, data: null, defaultStatus: 'todo' }
    })
  }

  const handleDeleteIssue = (issueId) => {
    updateScenario(activeScenarioId, (scenario) => ({
      ...scenario,
      issues: scenario.issues.filter((i) => i.id !== issueId),
      actionItems: scenario.actionItems.map((a) =>
        a.issueId === issueId ? { ...a, issueId: '' } : a
      )
    }))
  }

  const handleAddActionItem = () => {
    setModalState({
      ...modalState,
      actionItem: { isOpen: true, data: null, defaultStatus: 'pending' }
    })
  }

  const handleEditActionItem = (actionItem) => {
    setModalState({
      ...modalState,
      actionItem: { isOpen: true, data: actionItem, defaultStatus: actionItem.status }
    })
  }

  const handleSaveActionItem = (actionItemData) => {
    updateScenario(activeScenarioId, (scenario) => {
      if (modalState.actionItem.data) {
        return {
          ...scenario,
          actionItems: scenario.actionItems.map((a) =>
            a.id === actionItemData.id ? actionItemData : a
          )
        }
      } else {
        return {
          ...scenario,
          actionItems: [...scenario.actionItems, actionItemData]
        }
      }
    })
    setModalState({
      ...modalState,
      actionItem: { isOpen: false, data: null, defaultStatus: 'pending' }
    })
  }

  const handleDeleteActionItem = (actionItemId) => {
    updateScenario(activeScenarioId, (scenario) => ({
      ...scenario,
      actionItems: scenario.actionItems.filter((a) => a.id !== actionItemId)
    }))
  }

  const handleActionItemStatusChange = (actionItemId, newStatus) => {
    const now = new Date().toISOString()
    const isCompleted = newStatus === 'completed' || newStatus === 'verified'
    updateScenario(activeScenarioId, (scenario) => ({
      ...scenario,
      actionItems: scenario.actionItems.map((a) =>
        a.id === actionItemId
          ? {
              ...a,
              status: newStatus,
              updatedAt: now,
              completedAt: isCompleted && !a.completedAt ? now : a.completedAt
            }
          : a
      )
    }))
  }

  const handleDragStart = (e, issue) => {
    setDraggedIssue(issue)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragEnd = () => {
    setDraggedIssue(null)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = (e, targetStatus) => {
    e.preventDefault()
    if (!draggedIssue || draggedIssue.status === targetStatus) return

    const now = new Date().toISOString()
    updateScenario(activeScenarioId, (scenario) => ({
      ...scenario,
      issues: scenario.issues.map((i) =>
        i.id === draggedIssue.id
          ? { ...i, status: targetStatus, updatedAt: now }
          : i
      )
    }))
    setDraggedIssue(null)
  }

  const closeModal = (type) => {
    setModalState({
      ...modalState,
      [type]: { ...modalState[type], isOpen: false, data: null }
    })
  }

  const getSyncIcon = () => {
    if (isSyncing || syncState.status === syncStatus.SYNCING) return '🔄'
    if (syncState.status === syncStatus.ERROR) return '⚠️'
    if (syncState.status === syncStatus.SUCCESS) return '✅'
    return '☁️'
  }

  if (!activeScenario) {
    return (
      <div className="app">
        <ScenarioSidebar
          scenarios={scenarios}
          activeScenarioId={activeScenarioId}
          onSelectScenario={setActiveScenarioId}
          onAddScenario={handleAddScenario}
          onEditScenario={handleEditScenario}
          onDeleteScenario={handleDeleteScenario}
        />
        <main className="main-content">
          <div className="empty-main">
            <h2>请选择或创建一个演练场景</h2>
            <p>在左侧列表中选择演练，或点击 + 创建新的演练场景</p>
          </div>
        </main>
      </div>
    )
  }

  const stats = {
    total: activeScenario.issues.length,
    todo: activeScenario.issues.filter((i) => i.status === 'todo').length,
    inProgress: activeScenario.issues.filter((i) => i.status === 'in_progress').length,
    resolved: activeScenario.issues.filter((i) => i.status === 'resolved').length
  }

  const actionItems = activeScenario.actionItems || []
  const completedActions = actionItems.filter(
    (a) => a.status === 'completed' || a.status === 'verified'
  )
  const actionCompletionRate = actionItems.length > 0
    ? Math.round((completedActions.length / actionItems.length) * 100)
    : 0

  return (
    <div className="app">
      <ScenarioSidebar
        scenarios={scenarios}
        activeScenarioId={activeScenarioId}
        onSelectScenario={setActiveScenarioId}
        onAddScenario={handleAddScenario}
        onEditScenario={handleEditScenario}
        onDeleteScenario={handleDeleteScenario}
      />

      <main className="main-content">
        <header className="main-header">
          <div>
            <h1 className="scenario-title">{activeScenario.name}</h1>
            <p className="scenario-meta">
              📅 {formatDate(activeScenario.date)}
              {activeScenario.description && (
                <span className="meta-desc"> • {activeScenario.description}</span>
              )}
            </p>
            {(activeScenario.expectedSlo || activeScenario.actualRto) && (
              <p className="scenario-slo">
                {activeScenario.expectedSlo && (
                  <span>🎯 预期 SLO: {activeScenario.expectedSlo}</span>
                )}
                {activeScenario.actualRto && (
                  <span>⏱️ 实际 RTO: {activeScenario.actualRto}</span>
                )}
              </p>
            )}
          </div>
          <div className="header-actions">
            <button
              className="sync-btn"
              onClick={handleSyncNow}
              disabled={isSyncing}
              title={
                syncState.lastSyncTime
                  ? `上次同步: ${formatDateTime(syncState.lastSyncTime)}`
                  : '点击同步'
              }
            >
              {getSyncIcon()} {isSyncing ? '同步中...' : '同步'}
            </button>
            <button className="export-btn" onClick={handleExportReport}>
              📄 导出报告
            </button>
            <div className="stats-bar">
              <div className="stat-item">
                <span className="stat-label">总计</span>
                <span className="stat-value">{stats.total}</span>
              </div>
              <div className="stat-item todo">
                <span className="stat-label">待处理</span>
                <span className="stat-value">{stats.todo}</span>
              </div>
              <div className="stat-item in-progress">
                <span className="stat-label">处理中</span>
                <span className="stat-value">{stats.inProgress}</span>
              </div>
              <div className="stat-item resolved">
                <span className="stat-label">已解决</span>
                <span className="stat-value">{stats.resolved}</span>
              </div>
            </div>
          </div>
        </header>

        {activeScenario.objectives?.length > 0 && (
          <div className="objectives-section">
            <h3 className="section-title">🎯 演练目标</h3>
            <div className="objectives-grid">
              {activeScenario.objectives.map((obj) => (
                <div key={obj.id} className="objective-card">
                  <div className="objective-header">
                    <span className="objective-text">{obj.description}</span>
                    {obj.achieved != null && (
                      <span className={`achievement-badge ${obj.achieved ? 'achieved' : 'failed'}`}>
                        {obj.achieved ? '✅ 已达成' : '❌ 未达成'}
                      </span>
                    )}
                  </div>
                  {(obj.target || obj.actual != null) && (
                    <div className="objective-values">
                      {obj.target && <span>目标: {obj.target}</span>}
                      {obj.actual != null && <span>实际: {obj.actual}</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <ParticipantsPanel
          participants={activeScenario.participants}
          onAddParticipant={handleAddParticipant}
          onEditParticipant={handleEditParticipant}
          onDeleteParticipant={handleDeleteParticipant}
        />

        <div className="tabs-section">
          <div className="tabs-header">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <span className="tab-icon">{tab.icon}</span>
                <span>{tab.label}</span>
                {tab.id === 'actions' && actionItems.length > 0 && (
                  <span className="tab-badge">{actionCompletionRate}%</span>
                )}
              </button>
            ))}
          </div>

          <div className="tabs-content">
            {activeTab === 'kanban' && (
              <div className="kanban-board">
                <KanbanColumn
                  status="todo"
                  issues={activeScenario.issues}
                  participants={activeScenario.participants}
                  onEditIssue={handleEditIssue}
                  onDeleteIssue={handleDeleteIssue}
                  onAddIssue={handleAddIssue}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                />
                <KanbanColumn
                  status="in_progress"
                  issues={activeScenario.issues}
                  participants={activeScenario.participants}
                  onEditIssue={handleEditIssue}
                  onDeleteIssue={handleDeleteIssue}
                  onAddIssue={handleAddIssue}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                />
                <KanbanColumn
                  status="resolved"
                  issues={activeScenario.issues}
                  participants={activeScenario.participants}
                  onEditIssue={handleEditIssue}
                  onDeleteIssue={handleDeleteIssue}
                  onAddIssue={handleAddIssue}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                />
              </div>
            )}

            {activeTab === 'actions' && (
              <ActionItemsPanel
                actionItems={actionItems}
                participants={activeScenario.participants}
                issues={activeScenario.issues}
                onAddActionItem={handleAddActionItem}
                onEditActionItem={handleEditActionItem}
                onDeleteActionItem={handleDeleteActionItem}
                onStatusChange={handleActionItemStatusChange}
              />
            )}

            {activeTab === 'timeline' && (
              <div className="timeline-section">
                <Timeline scenario={activeScenario} />
              </div>
            )}

            {activeTab === 'graph' && (
              <div className="graph-section">
                <DependencyGraph scenario={activeScenario} />
              </div>
            )}
          </div>
        </div>
      </main>

      <Modal
        isOpen={modalState.scenario.isOpen}
        onClose={() => closeModal('scenario')}
        title={modalState.scenario.data ? '编辑演练场景' : '新建演练场景'}
      >
        <ScenarioForm
          key={modalState.scenario.data?.id || 'new'}
          scenario={modalState.scenario.data}
          onSubmit={handleSaveScenario}
          onCancel={() => closeModal('scenario')}
        />
      </Modal>

      <Modal
        isOpen={modalState.participant.isOpen}
        onClose={() => closeModal('participant')}
        title={modalState.participant.data ? '编辑参演人员' : '添加参演人员'}
      >
        <ParticipantForm
          key={modalState.participant.data?.id || 'new'}
          participant={modalState.participant.data}
          onSubmit={handleSaveParticipant}
          onCancel={() => closeModal('participant')}
        />
      </Modal>

      <Modal
        isOpen={modalState.issue.isOpen}
        onClose={() => closeModal('issue')}
        title={modalState.issue.data ? '编辑问题' : '添加问题'}
      >
        <IssueForm
          key={modalState.issue.data?.id || `new-${modalState.issue.defaultStatus}`}
          issue={
            modalState.issue.data
              ? { ...modalState.issue.data }
              : { status: modalState.issue.defaultStatus }
          }
          participants={activeScenario.participants}
          onSubmit={handleSaveIssue}
          onCancel={() => closeModal('issue')}
        />
      </Modal>

      <Modal
        isOpen={modalState.actionItem.isOpen}
        onClose={() => closeModal('actionItem')}
        title={modalState.actionItem.data ? '编辑 Action Item' : '添加 Action Item'}
      >
        <ActionItemForm
          key={modalState.actionItem.data?.id || `new-action-${modalState.actionItem.defaultStatus}`}
          actionItem={modalState.actionItem.data}
          participants={activeScenario.participants}
          issues={activeScenario.issues}
          defaultStatus={modalState.actionItem.defaultStatus}
          onSubmit={handleSaveActionItem}
          onCancel={() => closeModal('actionItem')}
        />
      </Modal>
    </div>
  )
}

export default App
