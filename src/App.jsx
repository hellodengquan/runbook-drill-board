import { useState, useEffect, useCallback, useRef } from 'react'
import {
  saveToStorage, loadFromStorage, getStorageInfo, getStorageEvictionLog,
  setStorageMode, getStorageMode, setConfig as setStorageConfig, getConfig as getStorageConfig
} from './utils/storage'
import {
  syncService, syncStatus, conflictResolution, useSync,
  ConfluenceAuthProvider, NotionAuthProvider,
  ConfluenceAuthMethod, NotionAuthMethod, driftUtils
} from './utils/syncApi'
import {
  formatDate,
  formatDateTime,
  exportMarkdownReport,
  downloadFile,
  formatSlo,
  formatRto,
  isRtoMet,
  calculateDowntimeFromSlo,
  createSloComposite,
  createRtoComposite,
  createSli,
  sliTypes,
  formatSli,
  isSliMet,
  validateSli,
  createSloWithSlis,
  createShiftRotation,
  severityConfig,
  getEscalationPath,
  checkSeverityEscalationNeeded,
  canReopenActionItem,
  buildActionItemReopenHistory,
  holidayPriorityLevels,
  getOnCallPerson,
  calendarProviders,
  CalendarSyncService,
  MlSeverityLearner,
  defaultRuntimeConfig,
  RuntimeConfigService,
  Role,
  permissions,
  clockDriftUtils
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
    expectedSlo: createSloWithSlis({ percent: 99.9, windowValue: 30, windowUnit: 'day' }),
    actualRto: createRtoComposite(5, 'minute', 8, 'minute'),
    updatedAt: '2026-06-10T18:00:00Z',
    objectives: [
      { id: 'obj1', description: '故障切换时间', target: '5 分钟', actual: '8 分钟', achieved: false },
      { id: 'obj2', description: '数据零丢失', target: '0 条', actual: '0 条', achieved: true },
      { id: 'obj3', description: '全员响应时间', target: '<3 分钟', actual: '2.5 分钟', achieved: true }
    ],
    participants: [
      {
        id: 'p1',
        name: '张伟',
        role: '总指挥',
        department: '运维部',
        shiftSchedule: '主班 9:00-18:00',
        phone: '13800138001',
        email: 'zhangwei@example.com',
        shiftRotation: createShiftRotation({
          primary: true,
          secondary: 'p2',
          backup: 'p3',
          holidayPriority: 2,
          handoffNotes: '节假日24小时待命，保持电话畅通'
        })
      },
      {
        id: 'p2',
        name: '李娜',
        role: '技术支持',
        department: 'DBA组',
        shiftSchedule: '备班 18:00-次日9:00',
        phone: '13800138002',
        email: 'lina@example.com',
        shiftRotation: createShiftRotation({
          primary: false,
          secondary: 'p3',
          backup: 'p1',
          holidayPriority: 1,
          handoffNotes: '法定节假日优先值班'
        })
      },
      {
        id: 'p3',
        name: '王强',
        role: '开发代表',
        department: '核心业务组',
        shiftSchedule: '主班 9:00-18:00',
        phone: '13800138003',
        email: 'wangqiang@example.com',
        shiftRotation: createShiftRotation({
          primary: false,
          secondary: 'p1',
          backup: 'p2',
          holidayPriority: 3,
          exceptionDates: ['2026-10-01', '2026-10-02']
        })
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
        escalationHistory: [],
        reopenCount: 0,
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
        escalationHistory: [
          { from: 'high', to: 'critical', at: '2026-06-10T10:45:00Z', reason: '响应延迟超阈值自动升级' }
        ],
        reopenCount: 0,
        createdAt: '2026-06-10T10:35:00Z',
        updatedAt: '2026-06-10T10:45:00Z'
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
        escalationHistory: [],
        reopenCount: 1,
        reopenHistory: [{ at: '2026-06-11T09:00:00Z', reason: '回滚文档仍有遗漏' }],
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
        reopenCount: 0,
        reopenHistory: [],
        lastReopenAt: null,
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
        reopenCount: 0,
        reopenHistory: [],
        lastReopenAt: null,
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
        reopenCount: 0,
        reopenHistory: [],
        lastReopenAt: null,
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
  const [scenarios, setScenarios] = useState(initialData)
  const [activeScenarioId, setActiveScenarioId] = useState(initialData[0].id)
  const [draggedIssue, setDraggedIssue] = useState(null)
  const [activeTab, setActiveTab] = useState('kanban')

  const [syncState, setSyncState] = useState(syncService.getStatus())
  const [isSyncing, setIsSyncing] = useState(false)

  const [storageInfo, setStorageInfo] = useState(() => getStorageInfo())
  const [evictionNotice, setEvictionNotice] = useState(null)
  const [storageBannerVisible, setStorageBannerVisible] = useState(false)

  const [exportFormat, setExportFormat] = useState('standard')
  const [exportMenuOpen, setExportMenuOpen] = useState(false)

  const [conflictModal, setConflictModal] = useState({ open: false, data: null })

  const [modalState, setModalState] = useState({
    scenario: { isOpen: false, data: null },
    participant: { isOpen: false, data: null },
    issue: { isOpen: false, data: null, defaultStatus: 'todo' },
    actionItem: { isOpen: false, data: null, defaultStatus: 'pending' },
    adminConfig: { isOpen: false },
    calendarSync: { isOpen: false }
  })

  const [runtimeConfig, setRuntimeConfigState] = useState(defaultRuntimeConfig)
  const runtimeSvc = useRef(null)
  const calendarSvc = useRef(null)
  const [currentUser, setCurrentUser] = useState({ id: 'u-admin-demo', name: '系统管理员', role: Role.ADMIN })
  const [calendarState, setCalendarState] = useState({
    holidays: [],
    shifts: [],
    lastSyncAt: null,
    syncing: false,
    provider: calendarProviders.MOCK
  })
  const [mlState, setMlState] = useState({
    sampleCount: 0,
    suggestion: null,
    learnedApplied: false
  })
  const [bootReady, setBootReady] = useState(false)

  /* --- 启动阶段：async 加载存储 + 服务初始化 --- */
  useEffect(() => {
    let cancelled = false
    const boot = async () => {
      try {
        runtimeSvc.current = new RuntimeConfigService(
          { getConfig: getStorageConfig, setConfig: setStorageConfig },
          defaultRuntimeConfig
        )
        runtimeSvc.current.setCurrentUser(currentUser)
        const loadCfg = runtimeSvc.current.load()
        const savedData = await loadFromStorage()
        const cfgRes = await loadCfg
        if (!cancelled) {
          if (cfgRes.ok) setRuntimeConfigState(runtimeSvc.current.config)
          if (savedData && savedData.length > 0) {
            setScenarios(savedData)
            setActiveScenarioId(savedData[0].id)
          }
          calendarSvc.current = new CalendarSyncService(calendarState.provider)
          setBootReady(true)
        }
      } catch (e) {
        console.error('[App] 启动异常:', e)
        setBootReady(true)
      }
    }
    boot()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    return syncService.subscribe(setSyncState)
  }, [])

  useEffect(() => {
    if (!bootReady || scenarios.length === 0) return
    let cancelled = false
    const persist = async () => {
      const result = await saveToStorage(scenarios)
      if (cancelled) return
      if (result?.evicted && result.evicted.length > 0) {
        setEvictionNotice(result)
        setStorageBannerVisible(true)
      }
      setStorageInfo(getStorageInfo())
    }
    persist()
    return () => { cancelled = true }
  }, [scenarios, bootReady])

  useEffect(() => {
    if (syncState.status === syncStatus.CONFLICT && syncState.pendingConflicts > 0) {
      setConflictModal({ open: true, data: syncState })
    }
  }, [syncState.status, syncState.pendingConflicts])

  useEffect(() => {
    const interval = setInterval(() => {
      setStorageInfo(getStorageInfo())
    }, 10000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    let syncTimeout
    const scheduleSync = () => {
      syncTimeout = setTimeout(async () => {
        if (scenarios.length > 0 && bootReady) {
          setIsSyncing(true)
          await syncService.push(scenarios)
          setIsSyncing(false)
        }
        scheduleSync()
      }, 30000)
    }
    if (bootReady) scheduleSync()
    return () => clearTimeout(syncTimeout)
  }, [scenarios, bootReady])

  /* --- 日历同步 --- */
  const handleCalendarSync = async () => {
    if (!calendarSvc.current) return
    setCalendarState(s => ({ ...s, syncing: true }))
    const svc = calendarSvc.current
    await svc.authenticate('demo-mock-token')
    const year = new Date().getFullYear()
    const holidaysRes = await svc.fetchHolidays(year)
    const from = new Date()
    const to = new Date(Date.now() + 30 * 86400_000)
    const shiftsRes = await svc.fetchOnCallCalendar('demo-cal', from.toISOString(), to.toISOString())
    setCalendarState(s => ({
      ...s,
      holidays: holidaysRes.holidays || [],
      shifts: shiftsRes.shifts || [],
      lastSyncAt: new Date().toISOString(),
      syncing: false
    }))
  }

  /* --- ML 严重度学习 --- */
  const handleCollectMlSamples = () => {
    let count = 0
    scenarios.forEach(s => {
      (s.issues || []).forEach(issue => {
        const dur = (new Date(issue.updatedAt || issue.createdAt || s.date) - new Date(issue.createdAt || s.date)) / 60000
        const sug = MlSeverityLearner.addSample(issue, Math.max(2, Math.abs(dur || 15)), issue.status)
        count++
        if (sug) setMlState(st => ({ ...st, suggestion: sug }))
      })
    })
    setMlState(st => ({ ...st, sampleCount: MlSeverityLearner.samples.length }))
    return { collected: count }
  }

  const handleApplyMlSuggestion = () => {
    if (!mlState.suggestion) return
    MlSeverityLearner.applyLearnedThresholds(severityConfig, mlState.suggestion)
    setMlState(st => ({ ...st, learnedApplied: true }))
  }

  /* --- 管理员配置保存 --- */
  const saveAdminConfig = async (partial) => {
    if (!runtimeSvc.current) return { ok: false, error: '服务未就绪' }
    const res = await runtimeSvc.current.save(partial, currentUser)
    if (res.ok) setRuntimeConfigState({ ...runtimeSvc.current.config })
    return res
  }

  const activeScenario = scenarios.find((s) => s.id === activeScenarioId)

  const updateScenario = useCallback((scenarioId, updater) => {
    setScenarios((prev) =>
      prev.map((s) => (s.id === scenarioId ? updater(s) : s))
    )
  }, [])

  const handleSyncNow = async () => {
    if (scenarios.length > 0) {
      setIsSyncing(true)
      const res = await syncService.push(scenarios)
      if (res?.conflict) {
        setConflictModal({ open: true, data: res })
      }
      setIsSyncing(false)
    }
  }

  const handleResolveConflict = async (resolution) => {
    const result = syncService.resolveConflict(0, resolution)
    if (result?.success && result.data) {
      setScenarios(result.data)
    }
    setConflictModal({ open: false, data: null })
  }

  const handleExportReport = (format = exportFormat) => {
    if (!activeScenario) return
    const markdown = exportMarkdownReport(activeScenario, format)
    const formatLabel = { standard: 'md', confluence: 'confluence-wiki', notion: 'notion-md' }[format] || 'md'
    const filename = `演练复盘-${activeScenario.name}-${new Date().toISOString().split('T')[0]}-${formatLabel}.md`
    downloadFile(markdown, filename, 'text/markdown;charset=utf-8')
    setExportMenuOpen(false)
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
    const maxReopen = runtimeConfig.actionItem?.maxReopen
    const cooldownHours = runtimeConfig.actionItem?.reopenCooldownHours
    const allowForce = runtimeSvc.current?.canForceReopen() || currentUser.role === Role.ADMIN

    updateScenario(activeScenarioId, (scenario) => {
      const target = scenario.actionItems.find(a => a.id === actionItemId)
      if (!target) return scenario

      const wasCompleted = target.status === 'completed' || target.status === 'verified'
      const isReopening = wasCompleted && !isCompleted

      if (isReopening) {
        const check = canReopenActionItem(target, {
          maxReopen: maxReopen != null ? maxReopen : 5,
          cooldownHours: cooldownHours != null ? cooldownHours : 24
        })
        if (!check.allowed && !allowForce) {
          alert(check.reason)
          return scenario
        }
      }

      return {
        ...scenario,
        actionItems: scenario.actionItems.map((a) => {
          if (a.id !== actionItemId) return a
          const base = {
            ...a,
            status: newStatus,
            updatedAt: now,
            completedAt: isCompleted && !a.completedAt ? now : (isCompleted ? a.completedAt : null)
          }
          if (isReopening) {
            return {
              ...base,
              reopenCount: (a.reopenCount || 0) + 1,
              lastReopenAt: now,
              reopenHistory: [...(a.reopenHistory || []), { at: now, reason: allowForce ? '管理员强制重开' : '用户手动重开', forced: allowForce }]
            }
          }
          return base
        })
      }
    })
  }

  const applySeverityAutoEscalation = () => {
    const now = new Date().toISOString()
    let changes = 0
    updateScenario(activeScenarioId, (scenario) => {
      const updatedIssues = scenario.issues.map(issue => {
        const esc = checkSeverityEscalationNeeded(issue)
        if (esc && esc.shouldEscalate) {
          changes++
          return {
            ...issue,
            severity: esc.toSeverity,
            updatedAt: now,
            escalationHistory: [
              ...(issue.escalationHistory || []),
              { from: issue.severity, to: esc.toSeverity, at: now, reason: esc.reason, auto: true }
            ]
          }
        }
        return issue
      })
      return { ...scenario, issues: updatedIssues }
    })
    return changes
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
    if (syncState.status === syncStatus.OFFLINE || !syncState.isOnline) return '📴'
    if (syncState.status === syncStatus.RETRYING || isSyncing || syncState.status === syncStatus.SYNCING) return '🔄'
    if (syncState.status === syncStatus.CONFLICT) return '⚠️'
    if (syncState.status === syncStatus.ERROR) return '❌'
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

  const sloStr = formatSlo(activeScenario.expectedSlo)
  const rtoStr = formatRto(activeScenario.actualRto)
  const rtoMet = isRtoMet(activeScenario.actualRto)
  const allowedDown = calculateDowntimeFromSlo(activeScenario.expectedSlo)

  const onCallInfo = getOnCallPerson(activeScenario.participants)
  const storageUsagePct = Math.round(storageInfo.usageRatio * 100)
  const storageCritical = storageInfo.isNearQuota

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
        {storageBannerVisible && storageCritical && (
          <div className={`storage-banner ${storageInfo.isOverQuota ? 'critical' : 'warning'}`}>
            <span>💾 存储使用 {storageUsagePct}% · {Math.round(storageInfo.usedBytes / 1024)}KB / 剩余 {Math.round(storageInfo.remainingBytes / 1024)}KB</span>
            {evictionNotice?.evicted?.length > 0 && (
              <span className="storage-evicted">已自动淘汰 {evictionNotice.evicted.length} 个旧演练</span>
            )}
            <button className="close-btn" onClick={() => setStorageBannerVisible(false)}>×</button>
          </div>
        )}

        {syncState.status === syncStatus.OFFLINE && (
          <div className="offline-banner">
            📴 离线模式
            {syncState.offlineQueueSize > 0 && ` · ${syncState.offlineQueueSize} 条同步队列待处理`}
            <button className="small-btn" onClick={() => syncService.flushOfflineQueue()}>立即重试</button>
          </div>
        )}

        <header className="main-header">
          <div>
            <h1 className="scenario-title">{activeScenario.name}</h1>
            <p className="scenario-meta">
              📅 {formatDate(activeScenario.date)}
              {activeScenario.description && (
                <span className="meta-desc"> • {activeScenario.description}</span>
              )}
            </p>
            {(sloStr || rtoStr) && (
              <div className="slo-rto-display">
                {sloStr && (
                  <div className={`slo-card ${activeScenario.expectedSlo && typeof activeScenario.expectedSlo === 'object' ? 'composite' : ''}`}>
                    <div className="slo-title">🎯 预期 SLO</div>
                    <div className="slo-value">{sloStr}</div>
                    {allowedDown && <div className="slo-sub">允许停机: {allowedDown}</div>}
                  </div>
                )}
                {rtoStr && (
                  <div className={`rto-card ${rtoMet != null ? (rtoMet ? 'met' : 'missed') : ''}`}>
                    <div className="rto-title">⏱️ 实际 RTO</div>
                    <div className="rto-value">{rtoStr}</div>
                    {rtoMet != null && (
                      <div className="rto-sub">{rtoMet ? '✅ 达成目标' : '❌ 未达标'}</div>
                    )}
                  </div>
                )}
                {activeScenario.expectedSlo?.slis?.length > 0 && (
                  <div className="sli-card" title={`包含 ${activeScenario.expectedSlo.slis.length} 项 SLI 指标`}>
                    <div className="sli-title">📊 SLI 指标</div>
                    {activeScenario.expectedSlo.slis.filter(s => s.enabled).slice(0, 4).map(sli => {
                      const met = isSliMet(sli)
                      return (
                        <div key={sli.id} className={`sli-row ${met === true ? 'ok' : met === false ? 'bad' : ''}`}>
                          <span className="sli-name">{formatSli(sli).slice(0, 30)}</span>
                          <span className="sli-state">{met === true ? '✅' : met === false ? '❌' : '⏳'}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
                {onCallInfo?.person && (
                  <div className="oncall-card" style={{ borderColor: holidayPriorityLevels.find(h => h.level === onCallInfo.priority)?.color }}>
                    <div className="oncall-title">📞 当前值班（{onCallInfo.priorityLabel}）</div>
                    <div className="oncall-value">{onCallInfo.person.name}</div>
                    <div className="oncall-sub">{onCallInfo.person.role} · {onCallInfo.person.phone}</div>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="header-actions">
            <div className="storage-mini">
              <span>💾</span>
              <div className="storage-bar">
                <div
                  className={`storage-bar-fill ${storageCritical ? 'warning' : ''}`}
                  style={{ width: `${storageUsagePct}%` }}
                />
              </div>
              <span className="storage-pct">{storageUsagePct}%</span>
            </div>
            <button
              className={`sync-btn ${syncState.status === syncStatus.CONFLICT ? 'conflict' : ''} ${syncState.status === syncStatus.OFFLINE ? 'offline' : ''}`}
              onClick={handleSyncNow}
              disabled={isSyncing || syncState.status === syncStatus.RETRYING}
              title={(
                syncState.lastSyncTime ? `上次同步: ${formatDateTime(syncState.lastSyncTime)}` : '点击同步'
              ) + (syncState.offlineQueueSize > 0 ? ` | 离线队列: ${syncState.offlineQueueSize}` : '') + (syncState.retryCount > 0 ? ` | 重试: ${syncState.retryCount}/${5}` : '')}
            >
              {getSyncIcon()} {isSyncing || syncState.status === syncStatus.RETRYING ? (syncState.retryCount > 1 ? `重试${syncState.retryCount}...` : '同步中...') : (syncState.status === syncStatus.CONFLICT ? '有冲突' : syncState.status === syncStatus.OFFLINE ? '离线' : '同步')}
            </button>
            <div className="export-wrap">
              <button className="export-btn" onClick={() => setExportMenuOpen(v => !v)}>
                📄 导出报告 ▾
              </button>
              {exportMenuOpen && (
                <div className="export-menu">
                  {[
                    { id: 'standard', label: '标准 Markdown', icon: '📝' },
                    { id: 'confluence', label: 'Confluence Wiki', icon: '📘' },
                    { id: 'notion', label: 'Notion 格式', icon: '📓' }
                  ].map(f => (
                    <button
                      key={f.id}
                      className={`export-menu-item ${exportFormat === f.id ? 'active' : ''}`}
                      onClick={() => { setExportFormat(f.id); handleExportReport(f.id) }}
                    >
                      <span>{f.icon}</span> {f.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
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
            <div className="admin-toolbar">
              <div className="user-chip" title={`角色: ${currentUser.role}`}>
                <span className="user-avatar">👤</span>
                <span className="user-name">{currentUser.name}</span>
                <span className={`user-role role-${currentUser.role}`}>{currentUser.role}</span>
              </div>
              <button className="admin-btn" onClick={() => setModalState(m => ({ ...m, calendarSync: { ...m.calendarSync, isOpen: true } }))}>
                📅 日历同步{calendarState.lastSyncAt ? `✓` : ''}
              </button>
              <button className={`admin-btn ${mlState.sampleCount > 0 ? 'active' : ''}`}
                      onClick={() => {
                        const r = handleCollectMlSamples()
                        if (mlState.suggestion) handleApplyMlSuggestion()
                      }}>
                🧠 ML{mlState.sampleCount > 0 && ` (${mlState.sampleCount})`}
              </button>
              <button className="admin-btn admin" onClick={() => setModalState(m => ({ ...m, adminConfig: { ...m.adminConfig, isOpen: true } }))}>
                ⚙️ 配置
              </button>
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
                <Timeline scenario={activeScenario} runtimeConfig={runtimeConfig} />
              </div>
            )}

            {activeTab === 'graph' && (
              <div className="graph-section">
                <DependencyGraph scenario={activeScenario} runtimeConfig={runtimeConfig} />
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

      <Modal
        isOpen={conflictModal.open}
        onClose={() => setConflictModal({ open: false, data: null })}
        title={`数据同步冲突 (${syncState.pendingConflicts || 1})`}
        size="large"
      >
        <div className="conflict-modal">
          <div className="conflict-header">
            <p className="conflict-desc">
              ⚠️ 检测到本地与远端数据冲突。远端版本（v{conflictModal.data?.remoteVersion || 0}）
              在 {conflictModal.data?.conflictDetails?.remoteUpdatedAt ? formatDateTime(conflictModal.data.conflictDetails.remoteUpdatedAt) : '未知时间'}
              被其他客户端修改。
            </p>
            <div className="conflict-stats">
              <div className="conflict-stat">
                <div className="conflict-stat-label">本地版本</div>
                <div className="conflict-stat-value">v{conflictModal.data?.localVersion || syncState.version || 0}</div>
              </div>
              <div className="conflict-stat">
                <div className="conflict-stat-label">远端版本</div>
                <div className="conflict-stat-value">v{conflictModal.data?.remoteVersion || 0}</div>
              </div>
              <div className="conflict-stat">
                <div className="conflict-stat-label">冲突项</div>
                <div className="conflict-stat-value">
                  {conflictModal.data?.conflictDetails?.conflictingFields?.length || '多个'}
                </div>
              </div>
            </div>
          </div>
          {conflictModal.data?.conflictDetails?.conflictingFields?.length > 0 && (
            <div className="conflict-fields-list">
              <h4>冲突字段明细：</h4>
              <ul>
                {conflictModal.data.conflictDetails.conflictingFields.slice(0, 8).map((f, i) => (
                  <li key={i}>
                    <span className="field-name">{f.field}</span>
                    <span className="field-local">本地: {JSON.stringify(f.local).slice(0, 30)}</span>
                    <span className="field-remote">远端: {JSON.stringify(f.remote).slice(0, 30)}</span>
                  </li>
                ))}
                {conflictModal.data.conflictDetails.conflictingFields.length > 8 && (
                  <li className="more-field">
                    ...以及 {conflictModal.data.conflictDetails.conflictingFields.length - 8} 个其他字段
                  </li>
                )}
              </ul>
            </div>
          )}
          <div className="conflict-resolutions">
            <button
              className="resolution-btn keep-local"
              onClick={() => handleResolveConflict(conflictResolution.LOCAL_WINS)}
            >
              🛡️ 保留本地版本
              <span className="resolution-sub">覆盖远端所有修改</span>
            </button>
            <button
              className="resolution-btn use-remote"
              onClick={() => handleResolveConflict(conflictResolution.REMOTE_WINS)}
            >
              🌐 使用远端版本
              <span className="resolution-sub">放弃本地未同步修改</span>
            </button>
            <button
              className="resolution-btn merge primary"
              onClick={() => handleResolveConflict(conflictResolution.MERGE)}
            >
              🔗 智能合并（推荐）
              <span className="resolution-sub">逐字段合并，保留双方变更</span>
            </button>
            <button
              className="resolution-btn manual"
              onClick={() => setConflictModal({ open: false, data: null })}
            >
              ✏️ 稍后手动处理
              <span className="resolution-sub">关闭弹窗手动比较</span>
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={modalState.adminConfig.isOpen}
        onClose={() => closeModal('adminConfig')}
        title="⚙️ 管理员运行时配置"
        size="large"
      >
        <div className="admin-config">
          <div className="admin-section">
            <h4>🔁 Action Item 重开配置</h4>
            <div className="config-row">
              <label>最大重开次数 (MAX_REOPEN)</label>
              <input type="number" min="0" max="99"
                     defaultValue={runtimeConfig.actionItem.maxReopen}
                     onBlur={(e) => saveAdminConfig({ actionItem: { maxReopen: Math.max(0, parseInt(e.target.value) || 0) } })} />
            </div>
            <div className="config-row">
              <label>冷却期 (小时)</label>
              <input type="number" min="0" max="720" step="1"
                     defaultValue={runtimeConfig.actionItem.reopenCooldownHours}
                     onBlur={(e) => saveAdminConfig({ actionItem: { reopenCooldownHours: Math.max(0, parseInt(e.target.value) || 0) } })} />
            </div>
          </div>

          <div className="admin-section">
            <h4>🔄 同步 & 时钟漂移</h4>
            <div className="config-row">
              <label>最大重试次数</label>
              <input type="number" min="0" max="20"
                     defaultValue={runtimeConfig.sync.maxRetries}
                     onBlur={(e) => saveAdminConfig({ sync: { maxRetries: Math.max(0, parseInt(e.target.value) || 0) } })} />
            </div>
            <div className="config-row">
              <label>时钟漂移容忍区间 (ms)</label>
              <input type="number" min="0" max="60000" step="500"
                     defaultValue={runtimeConfig.sync.clockDriftToleranceMs}
                     onBlur={(e) => {
                       const v = Math.max(0, parseInt(e.target.value) || 0)
                       driftUtils.toleranceMs = v
                       clockDriftUtils.DEFAULT_TOLERANCE_MS = v
                       saveAdminConfig({ sync: { clockDriftToleranceMs: v } })
                     }} />
            </div>
            <div className="config-row">
              <label>离线判定超时 (ms)</label>
              <input type="number" min="1000" max="60000" step="1000"
                     defaultValue={runtimeConfig.sync.offlineTimeoutMs}
                     onBlur={(e) => saveAdminConfig({ sync: { offlineTimeoutMs: Math.max(1000, parseInt(e.target.value) || 10000) } })} />
            </div>
          </div>

          <div className="admin-section">
            <h4>💾 存储 & 性能</h4>
            <div className="config-row">
              <label>本地存储配额 (MB，1~10)</label>
              <input type="number" min="1" max="10" step="1"
                     defaultValue={runtimeConfig.storage.localStorageQuotaMB}
                     onBlur={(e) => saveAdminConfig({ storage: { localStorageQuotaMB: Math.min(10, Math.max(1, parseInt(e.target.value) || 4)) } })} />
            </div>
            <div className="config-row">
              <label>启用 IndexedDB Fallback</label>
              <input type="checkbox"
                     defaultChecked={runtimeConfig.storage.useIndexedDBFallback}
                     onChange={(e) => {
                       saveAdminConfig({ storage: { useIndexedDBFallback: e.target.checked } })
                       setStorageMode(e.target.checked ? 'auto' : 'localStorage')
                     }} />
              <span className="muted">当前: {getStorageMode()} · IDB可用: {storageInfo.idbAvailable ? '是' : '否'}</span>
            </div>
            <div className="config-row">
              <label>移动端触摸优化 (passive + rAF)</label>
              <input type="checkbox"
                     defaultChecked={runtimeConfig.timeline.enableTouchOptimization}
                     onChange={(e) => saveAdminConfig({ timeline: { enableTouchOptimization: e.target.checked } })} />
            </div>
            <div className="config-row">
              <label>依赖图列层虚拟化</label>
              <input type="checkbox"
                     defaultChecked={runtimeConfig.depGraph.columnVirtualization}
                     onChange={(e) => saveAdminConfig({ depGraph: { columnVirtualization: e.target.checked } })} />
            </div>
          </div>

          <div className="admin-section">
            <h4>👥 角色与权限</h4>
            <div className="config-row">
              <label>当前用户角色</label>
              <select defaultValue={currentUser.role}
                      onChange={(e) => setCurrentUser(u => ({ ...u, role: e.target.value }))}>
                {Object.entries(Role).map(([k, v]) => (
                  <option key={v} value={v}>{k} ({v})</option>
                ))}
              </select>
            </div>
            <div className="perm-preview">
              <div className="perm-title">权限预览：</div>
              {Object.entries(permissions).map(([key, roles]) => (
                <div key={key} className="perm-row">
                  <span>{key}</span>
                  <span className={runtimeSvc.current?.can(currentUser.role, key) ? 'perm-ok' : 'perm-no'}>
                    {runtimeSvc.current?.can(currentUser.role, key) ? '✓ 允许' : '✗ 禁止'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="admin-section config-meta">
            <div>版本 v{runtimeConfig._meta?.version || 1} · 更新于 {formatDateTime(runtimeConfig._meta?.updatedAt)}</div>
            <div>更新人: {runtimeConfig._meta?.updatedBy || 'system'}</div>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={modalState.calendarSync.isOpen}
        onClose={() => closeModal('calendarSync')}
        title="📅 企业日历同步"
        size="medium"
      >
        <div className="calendar-sync">
          <div className="config-row">
            <label>日历 Provider</label>
            <select defaultValue={calendarState.provider.id}
                    onChange={(e) => {
                      const p = Object.values(calendarProviders).find(x => x.id === e.target.value) || calendarProviders.MOCK
                      setCalendarState(s => ({ ...s, provider: p }))
                      if (calendarSvc.current) calendarSvc.current.provider = p
                    }}>
              {Object.values(calendarProviders).map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.auth})</option>
              ))}
            </select>
          </div>

          <div className="config-row">
            <label>同步状态</label>
            <span>
              {calendarState.syncing ? '⏳ 同步中...' : (calendarState.lastSyncAt ? `✓ 已同步于 ${formatDateTime(calendarState.lastSyncAt)}` : '未同步')}
            </span>
          </div>

          <div className="calendar-actions">
            <button className="btn primary" onClick={handleCalendarSync} disabled={calendarState.syncing}>
              🔄 立即同步
            </button>
          </div>

          {calendarState.holidays.length > 0 && (
            <div className="holiday-list">
              <h4>🎊 已同步假期 ({calendarState.holidays.length})</h4>
              <ul>
                {calendarState.holidays.slice(0, 8).map(h => (
                  <li key={`${h.date}-${h.name}`} className={`holiday-item type-${h.type}`}>
                    <span className="holiday-date">{h.date}</span>
                    <span className="holiday-name">{h.name}</span>
                    <span className="holiday-type">{h.type}</span>
                  </li>
                ))}
                {calendarState.holidays.length > 8 && (
                  <li className="more-field">...以及 {calendarState.holidays.length - 8} 个假期</li>
                )}
              </ul>
            </div>
          )}

          {calendarState.shifts.length > 0 && (
            <div className="shift-list">
              <h4>👥 未来 7 天值班</h4>
              <ul>
                {calendarState.shifts.slice(0, 7).map(s => (
                  <li key={s.id} className="shift-item">
                    <span className="shift-date">{s.date}</span>
                    <span className="shift-primary">主班: {s.primary}</span>
                    <span className="shift-secondary">副班: {s.secondary}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {mlState.sampleCount > 0 && (
            <div className="ml-info">
              <h4>🧠 ML 严重度学习</h4>
              <div>已采集样本: {mlState.sampleCount}</div>
              {mlState.suggestion && (
                <div>
                  <div>最近建议: P95 时长阈值已学习 (样本 {mlState.suggestion.sampleCount})</div>
                  <div>生效状态: {mlState.learnedApplied ? '✓ 已应用到严重度配置' : '未应用'}</div>
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}

export default App
