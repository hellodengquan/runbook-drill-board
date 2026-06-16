export const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9)
}

export const formatDate = (dateString) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
}

export const formatDateTime = (dateString) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

/* ============================================
   SLO / RTO 复合格式
   ============================================ */

export const timeWindowUnits = [
  { id: 'minute', label: '分钟', multiplier: 1 },
  { id: 'hour', label: '小时', multiplier: 60 },
  { id: 'day', label: '天', multiplier: 1440 },
  { id: 'week', label: '周', multiplier: 10080 },
  { id: 'month', label: '月', multiplier: 43200 },
  { id: 'quarter', label: '季度', multiplier: 129600 },
  { id: 'year', label: '年', multiplier: 525600 }
]

export const createSloComposite = (percent = 99.9, windowValue = 30, windowUnit = 'day') => ({
  percent,
  windowValue,
  windowUnit,
  raw: `${percent}% @ ${windowValue} ${timeWindowUnits.find(u => u.id === windowUnit)?.label || '天'}`
})

export const createRtoComposite = (targetValue = 5, targetUnit = 'minute', actualValue = null, actualUnit = 'minute') => ({
  targetValue,
  targetUnit,
  actualValue,
  actualUnit,
  raw: actualValue != null
    ? `目标 ${targetValue} ${timeWindowUnits.find(u => u.id === targetUnit)?.label || '分钟'} / 实际 ${actualValue} ${timeWindowUnits.find(u => u.id === actualUnit)?.label || '分钟'}`
    : `目标 ${targetValue} ${timeWindowUnits.find(u => u.id === targetUnit)?.label || '分钟'}`
})

export const formatSlo = (slo) => {
  if (!slo) return ''
  if (typeof slo === 'string') return slo
  const unit = timeWindowUnits.find(u => u.id === slo.windowUnit)?.label || '天'
  return `${slo.percent}% 可用性 (${slo.windowValue} ${unit})`
}

export const formatRto = (rto) => {
  if (!rto) return ''
  if (typeof rto === 'string') return rto
  const tUnit = timeWindowUnits.find(u => u.id === rto.targetUnit)?.label || '分钟'
  if (rto.actualValue != null) {
    const aUnit = timeWindowUnits.find(u => u.id === rto.actualUnit)?.label || '分钟'
    return `目标 ${rto.targetValue}${tUnit} / 实际 ${rto.actualValue}${aUnit}`
  }
  return `目标 ${rto.targetValue}${tUnit}`
}

export const isRtoMet = (rto) => {
  if (!rto || typeof rto === 'string' || rto.actualValue == null) return null
  const tUnit = timeWindowUnits.find(u => u.id === rto.targetUnit)?.multiplier || 1
  const aUnit = timeWindowUnits.find(u => u.id === rto.actualUnit)?.multiplier || 1
  return (rto.actualValue * aUnit) <= (rto.targetValue * tUnit)
}

export const calculateDowntimeFromSlo = (slo) => {
  if (!slo || typeof slo === 'string') return null
  const unit = timeWindowUnits.find(u => u.id === slo.windowUnit)?.multiplier || 1440
  const totalMinutes = slo.windowValue * unit
  const allowedDowntime = totalMinutes * (1 - slo.percent / 100)
  if (allowedDowntime < 60) return `${allowedDowntime.toFixed(1)} 分钟`
  if (allowedDowntime < 1440) return `${(allowedDowntime / 60).toFixed(2)} 小时`
  return `${(allowedDowntime / 1440).toFixed(2)} 天`
}

/* ============================================
   SLI (Service Level Indicator) 扩展：错误率 + 吞吐量
   ============================================ */

export const sliTypes = {
  ERROR_RATE: 'error_rate',
  THROUGHPUT: 'throughput',
  LATENCY_P99: 'latency_p99',
  AVAILABILITY: 'availability'
}

export const throughputUnits = [
  { id: 'rps', label: 'RPS', multiplier: 1 },
  { id: 'rpm', label: 'RPM', multiplier: 1 / 60 },
  { id: 'qps', label: 'QPS', multiplier: 1 },
  { id: 'tps', label: 'TPS', multiplier: 1 }
]

export const createSli = (type = sliTypes.AVAILABILITY, config = {}) => {
  const base = {
    id: `sli-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    enabled: true,
    createdAt: new Date().toISOString()
  }
  switch (type) {
    case sliTypes.ERROR_RATE: {
      const threshold = config.threshold ?? 0.1
      return {
        ...base,
        threshold: Number(threshold.toFixed(6)),
        thresholdType: 'percent',
        actualValue: config.actualValue ?? null,
        raw: `错误率 ≤ ${Number(threshold.toFixed(2))}%`
      }
    }
    case sliTypes.THROUGHPUT: {
      const minVal = config.minValue ?? 1000
      const unit = config.unit ?? 'rps'
      return {
        ...base,
        minValue: minVal,
        unit,
        actualValue: config.actualValue ?? null,
        raw: `吞吐量 ≥ ${minVal} ${throughputUnits.find(u => u.id === unit)?.label || 'RPS'}`
      }
    }
    case sliTypes.LATENCY_P99: {
      const thresholdMs = config.thresholdMs ?? 500
      return {
        ...base,
        thresholdMs,
        actualValueMs: config.actualValueMs ?? null,
        raw: `P99 延迟 ≤ ${thresholdMs}ms`
      }
    }
    case sliTypes.AVAILABILITY:
    default: {
      const threshold = config.threshold ?? 99.9
      return {
        ...base,
        threshold: Number(threshold.toFixed(6)),
        thresholdType: 'percent',
        actualValue: config.actualValue ?? null,
        raw: `可用性 ≥ ${Number(threshold.toFixed(2))}%`
      }
    }
  }
}

export const createSloWithSlis = ({
  percent = 99.9,
  windowValue = 30,
  windowUnit = 'day',
  slis = null
} = {}) => {
  const base = createSloComposite(percent, windowValue, windowUnit)
  const errorRate = 100 - percent
  const defaultSlis = [
    createSli(sliTypes.AVAILABILITY, { threshold: percent }),
    createSli(sliTypes.ERROR_RATE, { threshold: Number(errorRate.toFixed(6)) }),
    createSli(sliTypes.THROUGHPUT, { minValue: 1000, unit: 'rps' })
  ]
  return {
    ...base,
    slis: slis || defaultSlis,
    sloVersion: '2.0-sli'
  }
}

export const validateSli = (sli) => {
  if (!sli || !sli.type) return { valid: false, reason: 'SLI 类型缺失' }
  switch (sli.type) {
    case sliTypes.ERROR_RATE:
      if (sli.threshold < 0 || sli.threshold > 100) return { valid: false, reason: '错误率阈值需 0~100%' }
      break
    case sliTypes.THROUGHPUT:
      if (sli.minValue < 0) return { valid: false, reason: '吞吐量不能为负' }
      break
  }
  return { valid: true }
}

export const isSliMet = (sli) => {
  if (!sli || sli.actualValue == null && sli.actualValueMs == null) return null
  switch (sli.type) {
    case sliTypes.ERROR_RATE:
      return sli.actualValue <= sli.threshold
    case sliTypes.THROUGHPUT:
      return sli.actualValue >= sli.minValue
    case sliTypes.LATENCY_P99:
      return sli.actualValueMs <= sli.thresholdMs
    case sliTypes.AVAILABILITY:
      return sli.actualValue >= sli.threshold
    default:
      return null
  }
}

export const formatSli = (sli) => {
  if (!sli) return ''
  switch (sli.type) {
    case sliTypes.ERROR_RATE:
      return `错误率 ${sli.actualValue != null ? `${Number(sli.actualValue.toFixed(2))}% / ` : ''}≤ ${Number(sli.threshold.toFixed(2))}%`
    case sliTypes.THROUGHPUT: {
      const unit = throughputUnits.find(u => u.id === sli.unit)?.label || 'RPS'
      return `吞吐量 ${sli.actualValue != null ? `${sli.actualValue}${unit} / ` : ''}≥ ${sli.minValue}${unit}`
    }
    case sliTypes.LATENCY_P99:
      return `P99 ${sli.actualValueMs != null ? `${sli.actualValueMs}ms / ` : ''}≤ ${sli.thresholdMs}ms`
    case sliTypes.AVAILABILITY:
    default:
      return `可用性 ${sli.actualValue != null ? `${Number(sli.actualValue.toFixed(2))}% / ` : ''}≥ ${Number(sli.threshold.toFixed(2))}%`
  }
}

/* ============================================
   Severity 升级 / 降级 阈值路径
   ============================================ */

export const severityConfig = {
  critical: {
    label: '致命',
    bg: '#fee2e2',
    text: '#991b1b',
    level: 4,
    dotColor: '#dc2626',
    escalation: {
      conditions: [
        { type: 'time', threshold: 30, unit: 'minute', description: '30分钟未响应自动升级' },
        { type: 'impact', threshold: 1000, description: '影响用户超1000升级' }
      ],
      next: null,
      contact: ['CxO', 'VP of Engineering']
    },
    deescalation: {
      conditions: [
        { type: 'status', to: 'resolved', description: '解决后可降级' }
      ],
      prev: 'high'
    }
  },
  high: {
    label: '高危',
    bg: '#fed7aa',
    text: '#9a3412',
    level: 3,
    dotColor: '#f97316',
    escalation: {
      conditions: [
        { type: 'time', threshold: 60, unit: 'minute', description: '1小时未处理升级到致命' },
        { type: 'impact', threshold: 500, description: '影响范围扩大升级' }
      ],
      next: 'critical',
      contact: ['Engineering Director', 'On-call Lead']
    },
    deescalation: {
      conditions: [
        { type: 'time_workaround', threshold: 4, unit: 'hour', description: '临时方案生效4小时后可降级' }
      ],
      prev: 'medium'
    }
  },
  medium: {
    label: '中危',
    bg: '#fef08a',
    text: '#854d0e',
    level: 2,
    dotColor: '#eab308',
    escalation: {
      conditions: [
        { type: 'time', threshold: 4, unit: 'hour', description: '4小时无进展升级到高危' },
        { type: 'reopen_count', threshold: 2, description: '同一问题重开2次升级' }
      ],
      next: 'high',
      contact: ['Team Lead', 'Senior Engineer']
    },
    deescalation: {
      conditions: [
        { type: 'status', to: 'resolved', description: '解决后可降级' }
      ],
      prev: 'low'
    }
  },
  low: {
    label: '低危',
    bg: '#dcfce7',
    text: '#166534',
    level: 1,
    dotColor: '#22c55e',
    escalation: {
      conditions: [
        { type: 'time', threshold: 24, unit: 'hour', description: '24小时未修复升级到中危' },
        { type: 'issue_count', threshold: 5, description: '关联5个以上同类问题升级' }
      ],
      next: 'medium',
      contact: ['Engineer']
    },
    deescalation: {
      conditions: [],
      prev: null
    }
  }
}

export const severityColors = Object.fromEntries(
  Object.entries(severityConfig).map(([k, v]) => [k, { bg: v.bg, text: v.text, label: v.label }])
)

export const getEscalationPath = (severity) => {
  const path = []
  let current = severity
  while (current) {
    path.push(current)
    current = severityConfig[current]?.escalation?.next
  }
  return path
}

export const getDeescalationPath = (severity) => {
  const path = []
  let current = severity
  while (current) {
    path.push(current)
    current = severityConfig[current]?.deescalation?.prev
  }
  return path
}

export const checkSeverityEscalationNeeded = (issue) => {
  const config = severityConfig[issue.severity]
  if (!config?.escalation?.next) return null

  const elapsed = issue.createdAt ? (Date.now() - new Date(issue.createdAt).getTime()) / 60000 : 0

  for (const condition of config.escalation.conditions) {
    if (condition.type === 'time') {
      const multiplier = timeWindowUnits.find(u => u.id === condition.unit)?.multiplier || 1
      if (elapsed >= condition.threshold * multiplier) {
        return {
          shouldEscalate: true,
          toSeverity: config.escalation.next,
          reason: condition.description,
          condition
        }
      }
    }
  }
  return null
}

/* ============================================
   状态配置
   ============================================ */

export const statusConfig = {
  todo: { label: '待处理', color: '#6b7280' },
  in_progress: { label: '处理中', color: '#2563eb' },
  resolved: { label: '已解决', color: '#16a34a' }
}

export const actionItemStatusConfig = {
  pending: { label: '待开始', color: '#6b7280' },
  in_progress: { label: '进行中', color: '#2563eb' },
  blocked: { label: '已阻塞', color: '#dc2626' },
  completed: { label: '已完成', color: '#16a34a' },
  verified: { label: '已验证', color: '#7c3aed' }
}

/* ============================================
   Action Item Reopen 限制
   ============================================ */

export const ACTION_ITEM_REOPEN_CONFIG = {
  maxReopens: 3,
  cooldownMinutes: 30,
  autoBlockThreshold: 2
}

export const canReopenActionItem = (actionItem) => {
  if (!actionItem) return { allowed: false, reason: 'Action Item 不存在' }

  const reopenCount = actionItem.reopenCount || 0
  const lastReopenAt = actionItem.lastReopenAt
  const now = Date.now()

  if (reopenCount >= ACTION_ITEM_REOPEN_CONFIG.maxReopens) {
    return {
      allowed: false,
      reason: `已达最大重开次数 (${ACTION_ITEM_REOPEN_CONFIG.maxReopens}次)，请升级处理流程`
    }
  }

  if (lastReopenAt) {
    const elapsed = (now - new Date(lastReopenAt).getTime()) / 60000
    if (elapsed < ACTION_ITEM_REOPEN_CONFIG.cooldownMinutes) {
      const remaining = Math.ceil(ACTION_ITEM_REOPEN_CONFIG.cooldownMinutes - elapsed)
      return {
        allowed: false,
        reason: `冷却期内，请 ${remaining} 分钟后再尝试，或联系主管审批`
      }
    }
  }

  return { allowed: true }
}

export const buildActionItemReopenHistory = (actionItem) => {
  const history = actionItem.reopenHistory || []
  return {
    count: actionItem.reopenCount || 0,
    history,
    exceedsAutoBlockThreshold: (actionItem.reopenCount || 0) >= ACTION_ITEM_REOPEN_CONFIG.autoBlockThreshold
  }
}

/* ============================================
   Role Rotation 节假日替班优先级
   ============================================ */

export const holidayPriorityLevels = [
  { level: 1, label: '一级应急', color: '#dc2626', description: '法定节假日+业务高峰' },
  { level: 2, label: '二级应急', color: '#f97316', description: '法定节假日' },
  { level: 3, label: '三级应急', color: '#eab308', description: '周末' },
  { level: 4, label: '常规值班', color: '#6b7280', description: '工作日' }
]

export const createShiftRotation = (opts = {}) => ({
  primary: opts.primary || null,
  secondary: opts.secondary || null,
  backup: opts.backup || null,
  holidayPriority: opts.holidayPriority || 4,
  exceptionDates: opts.exceptionDates || [],
  handoffNotes: opts.handoffNotes || ''
})

export const getOnCallPerson = (participants, date = new Date()) => {
  const dayOfWeek = date.getDay()
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6

  let priority = 4
  if (isWeekend) priority = 3

  const sorted = [...participants].sort((a, b) => {
    const pa = a.shiftRotation?.holidayPriority || 4
    const pb = b.shiftRotation?.holidayPriority || 4
    return pa - pb
  })

  const firstEligible = sorted.find(p => {
    const rotation = p.shiftRotation
    if (!rotation) return true
    if (rotation.exceptionDates?.includes(date.toISOString().split('T')[0])) return false
    return true
  })

  return {
    person: firstEligible || sorted[0],
    priority,
    priorityLabel: holidayPriorityLevels.find(h => h.level === priority)?.label
  }
}

export const rootCauseCategories = [
  { id: 'infrastructure', label: '基础设施', color: '#ef4444' },
  { id: 'application', label: '应用代码', color: '#f97316' },
  { id: 'configuration', label: '配置错误', color: '#eab308' },
  { id: 'network', label: '网络问题', color: '#22c55e' },
  { id: 'database', label: '数据库', color: '#3b82f6' },
  { id: 'human', label: '人为操作', color: '#8b5cf6' },
  { id: 'process', label: '流程缺陷', color: '#ec4899' },
  { id: 'external', label: '外部依赖', color: '#06b6d4' },
  { id: 'monitoring', label: '监控告警', color: '#84cc16' },
  { id: 'other', label: '其他', color: '#64748b' }
]

export const getRootCauseCategory = (id) => {
  return rootCauseCategories.find((c) => c.id === id) || rootCauseCategories[rootCauseCategories.length - 1]
}

export const isOverdue = (dueDate) => {
  if (!dueDate) return false
  return new Date(dueDate) < new Date()
}

export const getDaysUntilDue = (dueDate) => {
  if (!dueDate) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(dueDate)
  due.setHours(0, 0, 0, 0)
  const diffTime = due - today
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return diffDays
}

export const calculateRto = (startTime, endTime) => {
  if (!startTime || !endTime) return null
  const start = new Date(startTime)
  const end = new Date(endTime)
  const diffMs = end - start
  const diffMins = Math.floor(diffMs / (1000 * 60))
  if (diffMins < 60) {
    return `${diffMins} 分钟`
  }
  const hours = Math.floor(diffMins / 60)
  const mins = diffMins % 60
  return mins > 0 ? `${hours} 小时 ${mins} 分钟` : `${hours} 小时`
}

/* ============================================
   Timeline 事件
   ============================================ */

export const generateTimelineEvents = (scenario) => {
  const events = []

  if (scenario.date) {
    events.push({
      id: 'start',
      time: scenario.date,
      title: '演练开始',
      description: scenario.name,
      type: 'milestone'
    })
  }

  scenario.issues
    .filter((i) => i.createdAt)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    .forEach((issue) => {
      events.push({
        id: issue.id,
        time: issue.createdAt,
        title: `发现问题: ${issue.title}`,
        description: issue.description,
        type: 'issue',
        severity: issue.severity,
        issueId: issue.id
      })
      if (issue.escalationHistory?.length > 0) {
        issue.escalationHistory.forEach((e, i) => {
          events.push({
            id: `${issue.id}-escalation-${i}`,
            time: e.at,
            title: `严重度变更: ${e.from} → ${e.to}`,
            description: e.reason || '严重度调整',
            type: 'escalation',
            issueId: issue.id
          })
        })
      }
    })

  scenario.actionItems
    .filter((a) => a.createdAt)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    .forEach((action) => {
      events.push({
        id: action.id,
        time: action.createdAt,
        title: `创建 Action: ${action.title}`,
        description: action.description,
        type: 'action',
        status: action.status,
        actionId: action.id
      })
      if (action.reopenHistory?.length > 0) {
        action.reopenHistory.forEach((r, i) => {
          events.push({
            id: `${action.id}-reopen-${i}`,
            time: r.at,
            title: `Action 重开 #${i + 1}`,
            description: r.reason || '任务重新打开',
            type: 'reopen',
            actionId: action.id
          })
        })
      }
    })

  scenario.actionItems
    .filter((a) => a.completedAt)
    .forEach((action) => {
      events.push({
        id: `${action.id}-complete`,
        time: action.completedAt,
        title: `完成 Action: ${action.title}`,
        type: 'milestone'
      })
    })

  return events.sort((a, b) => new Date(a.time) - new Date(b.time))
}

/* ============================================
   Dependency Graph 性能优化 - 分层布局 + 聚合
   ============================================ */

const LAYER_CONFIG = {
  scenario: { layer: 0, nodeWidth: 140, nodeHeight: 48 },
  participant: { layer: 1, nodeWidth: 110, nodeHeight: 44 },
  issue: { layer: 2, nodeWidth: 130, nodeHeight: 44 },
  action: { layer: 3, nodeWidth: 120, nodeHeight: 44 }
}

const LAYER_X_GAP = 180
const NODE_Y_GAP = 70
const CLUSTER_THRESHOLD = 50

export const generateDependencyGraph = (scenario, options = {}) => {
  const enableOptimization = options.enableOptimization !== false
  const rawNodes = []
  const rawLinks = []

  rawNodes.push({
    id: 'scenario',
    label: scenario.name?.substring(0, 14) || '演练场景',
    fullLabel: scenario.name || '演练场景',
    type: 'scenario',
    layer: 0
  })

  scenario.participants.forEach((p) => {
    rawNodes.push({
      id: `participant-${p.id}`,
      label: p.name,
      fullLabel: `${p.name} (${p.role || ''})`,
      type: 'participant',
      role: p.role,
      layer: 1
    })
    rawLinks.push({ source: 'scenario', target: `participant-${p.id}`, type: 'participation' })
  })

  scenario.issues.forEach((issue) => {
    rawNodes.push({
      id: `issue-${issue.id}`,
      label: issue.title.substring(0, 15) + (issue.title.length > 15 ? '...' : ''),
      fullLabel: issue.title,
      type: 'issue',
      severity: issue.severity,
      status: issue.status,
      layer: 2
    })
    if (issue.assigneeId) {
      rawLinks.push({ source: `participant-${issue.assigneeId}`, target: `issue-${issue.id}`, type: 'assignment' })
    } else {
      rawLinks.push({ source: 'scenario', target: `issue-${issue.id}`, type: 'issue' })
    }
  })

  scenario.actionItems.forEach((action) => {
    rawNodes.push({
      id: `action-${action.id}`,
      label: action.title.substring(0, 15) + (action.title.length > 15 ? '...' : ''),
      fullLabel: action.title,
      type: 'action',
      status: action.status,
      layer: 3
    })
    if (action.issueId) {
      rawLinks.push({ source: `issue-${action.issueId}`, target: `action-${action.id}`, type: 'action-item' })
    } else {
      rawLinks.push({ source: 'scenario', target: `action-${action.id}`, type: 'action' })
    }
    if (action.assigneeId) {
      rawLinks.push({ source: `participant-${action.assigneeId}`, target: `action-${action.id}`, type: 'ownership' })
    }
  })

  const totalNodes = rawNodes.length
  const shouldCluster = enableOptimization && totalNodes > CLUSTER_THRESHOLD

  if (shouldCluster) {
    return buildClusteredGraph(rawNodes, rawLinks)
  }

  return buildLayeredGraph(rawNodes, rawLinks)
}

const buildLayeredGraph = (rawNodes, rawLinks) => {
  const nodesByLayer = {}
  rawNodes.forEach(n => {
    if (!nodesByLayer[n.layer]) nodesByLayer[n.layer] = []
    nodesByLayer[n.layer].push(n)
  })

  const maxLayerCount = Math.max(...Object.values(nodesByLayer).map(l => l.length))
  const svgWidth = (Object.keys(nodesByLayer).length) * LAYER_X_GAP + 120
  const svgHeight = maxLayerCount * NODE_Y_GAP + 120

  const nodes = rawNodes.map(node => {
    const layerNodes = nodesByLayer[node.layer]
    const indexInLayer = layerNodes.indexOf(node)
    const totalInLayer = layerNodes.length
    const xBase = 80 + node.layer * LAYER_X_GAP
    const yStart = (svgHeight - (totalInLayer * NODE_Y_GAP)) / 2 + NODE_Y_GAP / 2
    return {
      ...node,
      x: xBase,
      y: yStart + indexInLayer * NODE_Y_GAP,
      config: LAYER_CONFIG[node.type]
    }
  })

  const nodeLookup = Object.fromEntries(nodes.map(n => [n.id, n]))
  const links = rawLinks
    .filter(l => nodeLookup[l.source] && nodeLookup[l.target])
    .map(l => ({ ...l }))

  return {
    nodes,
    links,
    svgWidth,
    svgHeight,
    clustered: false,
    stats: { total: nodes.length, links: links.length }
  }
}

const buildClusteredGraph = (rawNodes, rawLinks) => {
  const clusters = {}

  rawNodes.forEach(node => {
    const clusterKey = node.type
    if (!clusters[clusterKey]) {
      clusters[clusterKey] = {
        id: `cluster-${clusterKey}`,
        type: 'cluster',
        subType: clusterKey,
        count: 0,
        children: [],
        label: getClusterLabel(clusterKey),
        layer: LAYER_CONFIG[clusterKey]?.layer || 0
      }
    }
    clusters[clusterKey].count++
    clusters[clusterKey].children.push(node)
  })

  const clusterNodes = Object.values(clusters)
  const maxLayerCount = Math.max(1, clusterNodes.length)
  const svgWidth = 5 * LAYER_X_GAP
  const svgHeight = Math.max(450, maxLayerCount * NODE_Y_GAP + 120)

  const layerToClusters = {}
  clusterNodes.forEach(c => {
    if (!layerToClusters[c.layer]) layerToClusters[c.layer] = []
    layerToClusters[c.layer].push(c)
  })

  const nodes = clusterNodes.map((cluster, i) => {
    const layerClusters = layerToClusters[cluster.layer] || [cluster]
    const indexInLayer = layerClusters.indexOf(cluster)
    const totalInLayer = layerClusters.length
    const xBase = 80 + cluster.layer * LAYER_X_GAP
    const yStart = (svgHeight - (totalInLayer * (NODE_Y_GAP + 40))) / 2 + NODE_Y_GAP / 2
    return {
      id: cluster.id,
      label: `${cluster.label} (${cluster.count})`,
      fullLabel: `${cluster.label}集合: ${cluster.count} 个节点`,
      type: 'cluster',
      subType: cluster.subType,
      cluster,
      layer: cluster.layer,
      x: xBase,
      y: yStart + indexInLayer * (NODE_Y_GAP + 40),
      config: { nodeWidth: 160, nodeHeight: 60 }
    }
  })

  const typeOrder = ['scenario', 'participant', 'issue', 'action']
  const links = []
  for (let i = 0; i < typeOrder.length - 1; i++) {
    const srcType = typeOrder[i]
    const tgtType = typeOrder[i + 1]
    if (clusters[srcType] && clusters[tgtType]) {
      const crossLinks = rawLinks.filter(l => {
        const s = rawNodes.find(n => n.id === l.source)
        const t = rawNodes.find(n => n.id === l.target)
        return s?.type === srcType && t?.type === tgtType
      })
      if (crossLinks.length > 0) {
        links.push({
          source: `cluster-${srcType}`,
          target: `cluster-${tgtType}`,
          type: 'cluster-link',
          count: crossLinks.length
        })
      }
    }
  }

  return {
    nodes,
    links,
    svgWidth,
    svgHeight,
    clustered: true,
    stats: {
      total: rawNodes.length,
      displayed: nodes.length,
      links: rawLinks.length,
      displayedLinks: links.length
    },
    clusters
  }
}

const getClusterLabel = (type) => {
  const map = { scenario: '演练', participant: '人员组', issue: '问题组', action: 'Action组' }
  return map[type] || type
}

/* ============================================
   Markdown 导出 (标准 / Confluence / Notion)
   ============================================ */

const buildReportSections = (scenario) => {
  const sections = {
    overview: {
      title: scenario.name,
      date: formatDate(scenario.date),
      description: scenario.description || ''
    },
    objectives: scenario.objectives || [],
    slo: scenario.expectedSlo,
    rto: scenario.actualRto,
    participants: scenario.participants || [],
    issues: scenario.issues || [],
    todoIssues: (scenario.issues || []).filter(i => i.status === 'todo'),
    inProgressIssues: (scenario.issues || []).filter(i => i.status === 'in_progress'),
    resolvedIssues: (scenario.issues || []).filter(i => i.status === 'resolved'),
    actionItems: scenario.actionItems || []
  }
  sections.rootCauseCounts = {}
  scenario.issues.forEach(issue => {
    if (issue.rootCause) {
      sections.rootCauseCounts[issue.rootCause] = (sections.rootCauseCounts[issue.rootCause] || 0) + 1
    }
  })
  sections.completedActions = sections.actionItems.filter(a => a.status === 'completed' || a.status === 'verified')
  return sections
}

const getAssignee = (participants, id) => participants.find(p => p.id === id)?.name || '-'

export const exportMarkdownReport = (scenario, format = 'standard') => {
  const s = buildReportSections(scenario)

  switch (format) {
    case 'confluence':
      return exportConfluenceReport(scenario, s)
    case 'notion':
      return exportNotionReport(scenario, s)
    default:
      return exportStandardMarkdown(scenario, s)
  }
}

const exportStandardMarkdown = (scenario, s) => {
  const lines = []
  lines.push(`# 应急演练复盘报告: ${s.overview.title}`)
  lines.push('')
  lines.push(`**演练日期**: ${s.overview.date}`)
  lines.push('')

  if (s.overview.description) {
    lines.push('## 演练概述')
    lines.push(s.overview.description)
    lines.push('')
  }

  if (s.objectives.length > 0) {
    lines.push('## 演练目标')
    s.objectives.forEach((obj, i) => {
      lines.push(`${i + 1}. ${obj.description}`)
      if (obj.target) lines.push(`   - 目标值: ${obj.target}`)
      if (obj.actual != null) {
        lines.push(`   - 实际值: ${obj.actual}`)
        lines.push(`   - 达成状态: ${obj.achieved ? '✅ 已达成' : '❌ 未达成'}`)
      }
    })
    lines.push('')
  }

  if (s.slo || s.rto) {
    lines.push('## SLO 与 RTO')
    if (s.slo) lines.push(`- **预期 SLO**: ${typeof s.slo === 'string' ? s.slo : formatSlo(s.slo)}`)
    if (s.rto) {
      const rtoStr = typeof s.rto === 'string' ? s.rto : formatRto(s.rto)
      const met = isRtoMet(s.rto)
      const metStr = met != null ? (met ? ' ✅ 达成' : ' ❌ 未达成') : ''
      lines.push(`- **实际 RTO**: ${rtoStr}${metStr}`)
    }
    lines.push('')
  }

  lines.push('## 参演人员')
  lines.push('')
  lines.push('| 姓名 | 角色 | 部门 | 值班安排 | 节假日优先级 |')
  lines.push('|------|------|------|----------|-------------|')
  s.participants.forEach(p => {
    const shift = p.shiftSchedule || '-'
    const hp = p.shiftRotation?.holidayPriority
    const hpLabel = hp ? holidayPriorityLevels.find(h => h.level === hp)?.label || '常规' : '常规'
    lines.push(`| ${p.name} | ${p.role || '-'} | ${p.department || '-'} | ${shift} | ${hpLabel} |`)
  })
  lines.push('')

  lines.push('## 问题统计')
  lines.push('')
  lines.push(`- 总计: ${s.issues.length} 个问题`)
  lines.push(`- 待处理: ${s.todoIssues.length} 个`)
  lines.push(`- 处理中: ${s.inProgressIssues.length} 个`)
  lines.push(`- 已解决: ${s.resolvedIssues.length} 个`)
  lines.push(`- 解决率: ${s.issues.length > 0 ? Math.round((s.resolvedIssues.length / s.issues.length) * 100) : 0}%`)
  lines.push('')

  if (s.todoIssues.length > 0) {
    lines.push('### 待处理问题')
    lines.push('')
    lines.push('| 严重程度 | 问题 | 责任人 | 截止日期 | 升级路径 |')
    lines.push('|----------|------|--------|----------|----------|')
    s.todoIssues.forEach(issue => {
      const severity = severityConfig[issue.severity]?.label || issue.severity
      const dueDate = issue.dueDate ? formatDate(issue.dueDate) : '-'
      const esc = getEscalationPath(issue.severity).map(s2 => severityConfig[s2]?.label).join(' → ')
      lines.push(`| ${severity} | ${issue.title} | ${getAssignee(s.participants, issue.assigneeId)} | ${dueDate} | ${esc} |`)
    })
    lines.push('')
  }

  if (s.inProgressIssues.length > 0) {
    lines.push('### 处理中问题')
    lines.push('')
    lines.push('| 严重程度 | 问题 | 责任人 | 截止日期 | 升级路径 |')
    lines.push('|----------|------|--------|----------|----------|')
    s.inProgressIssues.forEach(issue => {
      const severity = severityConfig[issue.severity]?.label || issue.severity
      const dueDate = issue.dueDate ? formatDate(issue.dueDate) : '-'
      const esc = getEscalationPath(issue.severity).map(s2 => severityConfig[s2]?.label).join(' → ')
      lines.push(`| ${severity} | ${issue.title} | ${getAssignee(s.participants, issue.assigneeId)} | ${dueDate} | ${esc} |`)
    })
    lines.push('')
  }

  if (s.resolvedIssues.length > 0) {
    lines.push('### 已解决问题')
    lines.push('')
    lines.push('| 严重程度 | 问题 | 责任人 | 解决方案 |')
    lines.push('|----------|------|--------|----------|')
    s.resolvedIssues.forEach(issue => {
      const severity = severityConfig[issue.severity]?.label || issue.severity
      const resolution = issue.resolution || '-'
      lines.push(`| ${severity} | ${issue.title} | ${getAssignee(s.participants, issue.assigneeId)} | ${resolution} |`)
    })
    lines.push('')
  }

  if (Object.keys(s.rootCauseCounts).length > 0) {
    lines.push('## 根因分析')
    lines.push('')
    Object.entries(s.rootCauseCounts).forEach(([category, count]) => {
      const cat = getRootCauseCategory(category)
      lines.push(`- **${cat.label}**: ${count} 个问题`)
    })
    lines.push('')
  }

  if (s.actionItems.length > 0) {
    lines.push('## Action Items')
    lines.push('')
    lines.push('| 状态 | 任务 | 责任人 | 截止日期 | 重开次数 |')
    lines.push('|------|------|--------|----------|----------|')
    s.actionItems.forEach(action => {
      const status = actionItemStatusConfig[action.status]?.label || action.status
      const dueDate = action.dueDate ? formatDate(action.dueDate) : '-'
      const rc = action.reopenCount || 0
      lines.push(`| ${status} | ${action.title} | ${getAssignee(s.participants, action.assigneeId)} | ${dueDate} | ${rc} |`)
    })
    lines.push('')
    lines.push(`### Action Item 完成率`)
    lines.push(`${s.completedActions.length} / ${s.actionItems.length} (${
      s.actionItems.length > 0 ? Math.round((s.completedActions.length / s.actionItems.length) * 100) : 0
    }%)`)
    lines.push('')
  }

  lines.push('---')
  lines.push(`*报告生成时间: ${formatDateTime(new Date().toISOString())}*`)
  return lines.join('\n')
}

const exportConfluenceReport = (scenario, s) => {
  const lines = []
  lines.push(`h1. 应急演练复盘报告: ${s.overview.title}`)
  lines.push('')
  lines.push(`*演练日期*: ${s.overview.date}`)
  lines.push('')
  lines.push(`{status:title=演练状态|color=green}`)
  lines.push('')

  if (s.overview.description) {
    lines.push('h2. 演练概述')
    lines.push(`{panel:title=概述|borderStyle=dashed|borderColor=#ccc}`)
    lines.push(s.overview.description)
    lines.push('{panel}')
    lines.push('')
  }

  if (s.objectives.length > 0) {
    lines.push('h2. 演练目标')
    s.objectives.forEach((obj, i) => {
      const icon = obj.achieved ? '(check)' : '(x)'
      lines.push(`* ${i + 1}. ${obj.description} ${icon}`)
      if (obj.target) lines.push(`** 目标值: ${obj.target}`)
      if (obj.actual != null) lines.push(`** 实际值: ${obj.actual}`)
    })
    lines.push('')
  }

  lines.push('h2. 参演人员')
  lines.push('')
  lines.push('|| 姓名 || 角色 || 部门 || 值班安排 || 节假日优先级 ||')
  s.participants.forEach(p => {
    const shift = p.shiftSchedule || '-'
    const hp = p.shiftRotation?.holidayPriority
    const hpLabel = hp ? holidayPriorityLevels.find(h => h.level === hp)?.label || '常规' : '常规'
    lines.push(`| ${p.name} | ${p.role || '-'} | ${p.department || '-'} | ${shift} | ${hpLabel} |`)
  })
  lines.push('')

  lines.push('h2. 问题统计')
  lines.push(`{chart:type=pie|title=问题分布|width=400|height=300}`)
  lines.push(`待处理=${s.todoIssues.length}`)
  lines.push(`处理中=${s.inProgressIssues.length}`)
  lines.push(`已解决=${s.resolvedIssues.length}`)
  lines.push('{chart}')
  lines.push('')

  if (s.actionItems.length > 0) {
    lines.push('h2. Action Items 进度')
    lines.push(`{progress:total=${s.actionItems.length}|color=green}`)
    lines.push(`${s.completedActions.length}`)
    lines.push('{progress}')
    lines.push('')
  }

  lines.push('h2. 问题明细')
  lines.push('')
  lines.push('|| 严重程度 || 问题 || 责任人 || 状态 || 截止日期 ||')
  s.issues.forEach(issue => {
    const severity = severityConfig[issue.severity]?.label || issue.severity
    const status = statusConfig[issue.status]?.label || issue.status
    const dueDate = issue.dueDate ? formatDate(issue.dueDate) : '-'
    lines.push(`| ${severity} | ${issue.title} | ${getAssignee(s.participants, issue.assigneeId)} | ${status} | ${dueDate} |`)
  })
  lines.push('')

  lines.push('{toc}')
  lines.push('')
  lines.push(`{note}报告生成时间: ${formatDateTime(new Date().toISOString())}{note}`)
  return lines.join('\n')
}

const exportNotionReport = (scenario, s) => {
  const lines = []
  lines.push(`# 📋 应急演练复盘: ${s.overview.title}`)
  lines.push('')
  lines.push('> [!info] 基本信息')
  lines.push(`> - **演练日期**: ${s.overview.date}`)
  if (s.overview.description) lines.push(`> - **描述**: ${s.overview.description}`)
  lines.push('')

  if (s.slo || s.rto) {
    lines.push('## 🎯 SLO / RTO 指标')
    lines.push('')
    if (s.slo) lines.push(`- 📊 **SLO**: ${typeof s.slo === 'string' ? s.slo : formatSlo(s.slo)}`)
    if (s.rto) {
      const rtoStr = typeof s.rto === 'string' ? s.rto : formatRto(s.rto)
      const met = isRtoMet(s.rto)
      lines.push(`- ⏱️ **RTO**: ${rtoStr} ${met != null ? (met ? '✅' : '❌') : ''}`)
    }
    lines.push('')
  }

  if (s.objectives.length > 0) {
    lines.push('## 🎯 演练目标')
    lines.push('')
    s.objectives.forEach((obj) => {
      const status = obj.achieved ? '✅ Done' : '🔄 In Progress'
      lines.push(`- [${obj.achieved ? 'x' : ' '}] **${obj.description}** — ${status}`)
      if (obj.target) lines.push(`  - 目标: \`${obj.target}\``)
      if (obj.actual != null) lines.push(`  - 实际: \`${obj.actual}\``)
    })
    lines.push('')
  }

  lines.push('## 👥 参演人员')
  lines.push('')
  lines.push('| 姓名 | 角色 | 部门 | 节假日等级 |')
  lines.push('| :--- | :--- | :--- | :--- |')
  s.participants.forEach(p => {
    const hp = p.shiftRotation?.holidayPriority
    const hpLabel = hp ? holidayPriorityLevels.find(h => h.level === hp)?.label || '常规' : '常规'
    lines.push(`| ${p.name} | ${p.role || '-'} | ${p.department || '-'} | ${hpLabel} |`)
  })
  lines.push('')

  lines.push('## 📈 问题汇总 (看板视图)')
  lines.push('')
  lines.push('### 📝 待处理')
  s.todoIssues.forEach(i => lines.push(`- **${severityConfig[i.severity]?.label || ''}** \`${i.title}\` @${getAssignee(s.participants, i.assigneeId)}`))
  lines.push('')
  lines.push('### 🔄 处理中')
  s.inProgressIssues.forEach(i => lines.push(`- **${severityConfig[i.severity]?.label || ''}** \`${i.title}\` @${getAssignee(s.participants, i.assigneeId)}`))
  lines.push('')
  lines.push('### ✅ 已解决')
  s.resolvedIssues.forEach(i => lines.push(`- **${severityConfig[i.severity]?.label || ''}** \`${i.title}\` @${getAssignee(s.participants, i.assigneeId)}`))
  lines.push('')

  if (s.actionItems.length > 0) {
    lines.push('## ✅ Action Items')
    lines.push('')
    const completionRate = s.actionItems.length > 0 ? Math.round((s.completedActions.length / s.actionItems.length) * 100) : 0
    lines.push(`> 完成率: ${completionRate}% (${s.completedActions.length}/${s.actionItems.length})`)
    lines.push('')
    s.actionItems.forEach(a => {
      const done = a.status === 'completed' || a.status === 'verified'
      const statusIcon = { pending: '⏳', in_progress: '🔄', blocked: '🚫', completed: '✅', verified: '✓' }[a.status] || '•'
      lines.push(`- [${done ? 'x' : ' '}] ${statusIcon} **${a.title}** — @${getAssignee(s.participants, a.assigneeId)}`)
      if (a.reopenCount) lines.push(`  ⚠️ 已重开 ${a.reopenCount} 次`)
    })
    lines.push('')
  }

  lines.push('---')
  lines.push(`*Created: ${formatDateTime(new Date().toISOString())} | Powered by Drill Board*`)
  return lines.join('\n')
}

export const downloadFile = (content, filename, mimeType = 'text/markdown') => {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/* ============================================
   Severity ML 自动学习：历史样本采集 + 分位数学习
   ============================================ */

export const MlSeverityLearner = {
  samples: [],
  MAX_SAMPLES: 5000,
  LEARNING_INTERVAL: 100,

  addSample(issue, actualDurationMin, finalResolution) {
    if (this.samples.length >= this.MAX_SAMPLES) {
      this.samples.splice(0, 200)
    }
    this.samples.push({
      id: `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
      severity: issue.severity,
      rootCause: issue.rootCause || 'unknown',
      durationMin: actualDurationMin,
      impactUsers: issue.impactUsers || 0,
      reopenCount: issue.reopenCount || 0,
      finalResolution,
      takenAt: Date.now()
    })
    if (this.samples.length > 0 && this.samples.length % this.LEARNING_INTERVAL === 0) {
      return this.calculateSuggestedThresholds()
    }
    return null
  },

  _percentile(arr, p) {
    if (!arr.length) return 0
    const sorted = [...arr].sort((a, b) => a - b)
    const idx = Math.min(Math.floor((p / 100) * sorted.length), sorted.length - 1)
    return sorted[idx]
  },

  _groupBySeverity() {
    const groups = {}
    this.samples.forEach(s => {
      if (!groups[s.severity]) groups[s.severity] = []
      groups[s.severity].push(s)
    })
    return groups
  },

  calculateSuggestedThresholds() {
    const groups = this._groupBySeverity()
    const suggestion = { generatedAt: Date.now(), sampleCount: this.samples.length, thresholds: {} }
    Object.keys(groups).forEach(sev => {
      const list = groups[sev]
      const durations = list.map(s => s.durationMin)
      const impacts = list.map(s => s.impactUsers)
      suggestion.thresholds[sev] = {
        durationP50: this._percentile(durations, 50),
        durationP95: this._percentile(durations, 95),
        durationP99: this._percentile(durations, 99),
        impactP95: this._percentile(impacts, 95),
        autoEscalationMinutes: Math.max(5, Math.round(this._percentile(durations, 60))),
        impactThreshold: Math.max(10, Math.round(this._percentile(impacts, 80)))
      }
    })
    return suggestion
  },

  applyLearnedThresholds(baseConfig, suggestion) {
    if (!suggestion || !suggestion.thresholds) return baseConfig
    const merged = JSON.parse(JSON.stringify(baseConfig))
    Object.keys(suggestion.thresholds).forEach(sev => {
      if (!merged[sev]) return
      const learned = suggestion.thresholds[sev]
      const esc = merged[sev].escalation
      if (esc && esc.conditions) {
        esc.conditions.forEach(c => {
          if (c.type === 'time') c.threshold = learned.autoEscalationMinutes
          if (c.type === 'impact') c.threshold = learned.impactThreshold
        })
      }
    })
    merged._learned = { at: suggestion.generatedAt, samples: suggestion.sampleCount }
    return merged
  }
}

/* ============================================
   企业日历同步 Provider 抽象
   ============================================ */

export const calendarProviders = {
  GOOGLE: { id: 'google', name: 'Google Workspace', auth: 'oauth2', endpoint: 'https://www.googleapis.com/calendar/v3' },
  OFFICE365: { id: 'office365', name: 'Microsoft 365', auth: 'oauth2', endpoint: 'https://graph.microsoft.com/v1.0' },
  WECOM: { id: 'wecom', name: '企业微信', auth: 'access_token', endpoint: 'https://qyapi.weixin.qq.com/cgi-bin' },
  DINGTALK: { id: 'dingtalk', name: '钉钉', auth: 'access_token', endpoint: 'https://oapi.dingtalk.com' },
  MOCK: { id: 'mock', name: 'Mock (本地演示)', auth: 'none', endpoint: '' }
}

export class CalendarSyncService {
  constructor(provider = calendarProviders.MOCK, credentials = {}) {
    this.provider = provider
    this.credentials = credentials
    this.lastSyncAt = null
    this.cache = { holidays: [], onCallShifts: [] }
  }

  async authenticate(codeOrToken) {
    switch (this.provider.auth) {
      case 'oauth2':
        this.credentials.accessToken = codeOrToken
        this.credentials.expiresAt = Date.now() + 3600_000
        break
      case 'access_token':
        this.credentials.accessToken = codeOrToken
        break
      case 'none':
      default:
        this.credentials.accessToken = 'mock-token'
    }
    return { ok: true, provider: this.provider.id }
  }

  isTokenValid() {
    if (!this.credentials.accessToken) return false
    if (this.provider.auth === 'none') return true
    if (!this.credentials.expiresAt) return true
    return Date.now() < this.credentials.expiresAt - 300_000
  }

  async fetchHolidays(year = new Date().getFullYear()) {
    if (!this.isTokenValid()) return { ok: false, error: '未授权或Token过期', holidays: [] }
    const cached = this.cache.holidays.find(h => h.year === year)
    if (cached && (Date.now() - cached.fetchedAt) < 3600_000) return { ok: true, holidays: cached.days }
    const mockHolidays = this._generateMockHolidays(year)
    this.cache.holidays.push({ year, fetchedAt: Date.now(), days: mockHolidays })
    this.lastSyncAt = Date.now()
    return { ok: true, holidays: mockHolidays, source: this.provider.id }
  }

  async fetchOnCallCalendar(calendarId, from, to) {
    if (!this.isTokenValid()) return { ok: false, error: '未授权', shifts: [] }
    const mockShifts = this._generateMockOnCalls(from, to)
    this.cache.onCallShifts.push({ calendarId, from, to, shifts: mockShifts, fetchedAt: Date.now() })
    this.lastSyncAt = Date.now()
    return { ok: true, shifts: mockShifts, source: this.provider.id }
  }

  matchHolidayPriority(dateStr, holidays, priorityLevels) {
    const d = new Date(dateStr)
    const hit = holidays.find(h => h.date === formatDate(dateStr))
    if (hit) {
      const weight = hit.type === 'statutory' ? 5 : hit.type === 'public' ? 4 : hit.type === 'company' ? 3 : 2
      const matched = priorityLevels.find(l => l.weight === weight) || priorityLevels[priorityLevels.length - 1]
      return { isHoliday: true, meta: hit, priority: matched, weight }
    }
    const wd = d.getDay()
    if (wd === 0 || wd === 6) {
      const matched = priorityLevels.find(l => l.weight === 2) || priorityLevels[priorityLevels.length - 1]
      return { isHoliday: true, meta: { type: 'weekend', name: wd === 0 ? '周日' : '周六' }, priority: matched, weight: 2 }
    }
    return { isHoliday: false, priority: priorityLevels[0] || { id: 'workday', name: '工作日', weight: 1 }, weight: 1 }
  }

  _generateMockHolidays(year) {
    return [
      { date: `${year}-01-01`, name: '元旦', type: 'statutory' },
      { date: `${year}-02-10`, name: '春节', type: 'statutory' },
      { date: `${year}-02-11`, name: '春节', type: 'statutory' },
      { date: `${year}-02-12`, name: '春节', type: 'statutory' },
      { date: `${year}-04-06`, name: '清明节', type: 'statutory' },
      { date: `${year}-05-01`, name: '劳动节', type: 'statutory' },
      { date: `${year}-06-22`, name: '端午节', type: 'statutory' },
      { date: `${year}-10-01`, name: '国庆', type: 'statutory' },
      { date: `${year}-02-14`, name: '情人节', type: 'company' },
      { date: `${year}-12-25`, name: '圣诞节', type: 'public' }
    ]
  }

  _generateMockOnCalls(from, to) {
    const result = []
    const start = new Date(from)
    const end = new Date(to)
    let cur = new Date(start)
    const persons = ['张三', '李四', '王五', '赵六', '孙七']
    let idx = 0
    while (cur <= end) {
      result.push({
        id: `shift-${cur.getTime()}`,
        date: formatDate(cur.toISOString()),
        primary: persons[idx % persons.length],
        secondary: persons[(idx + 1) % persons.length],
        startTime: '09:00',
        endTime: '次日09:00'
      })
      idx++
      cur.setDate(cur.getDate() + 1)
    }
    return result
  }
}

/* ============================================
   Runtime 管理员配置系统 + 权限校验
   ============================================ */

export const Role = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  REVIEWER: 'reviewer',
  MEMBER: 'member',
  GUEST: 'guest'
}

export const defaultRuntimeConfig = {
  actionItem: {
    maxReopen: 5,
    reopenCooldownHours: 24,
    allowForceReopenRole: [Role.ADMIN, Role.MANAGER]
  },
  severity: {
    enableAutoEscalation: true,
    enableMlLearning: true,
    minEscalationMinutes: 5
  },
  storage: {
    localStorageQuotaMB: 4,
    useIndexedDBFallback: true,
    evictOnStartup: false
  },
  sync: {
    maxRetries: 5,
    clockDriftToleranceMs: 5000,
    offlineTimeoutMs: 10000,
    snapshotMergeEnabled: true
  },
  timeline: {
    enableTouchOptimization: true,
    androidLowEndThrottleMs: 16,
    passiveEvents: true
  },
  depGraph: {
    columnVirtualization: true,
    clusterThreshold: 8,
    maxNodesFullView: 300
  },
  export: {
    confluenceSpaceKey: 'DRILL',
    notionParentPageId: '',
    defaultFormat: 'standard'
  },
  _meta: {
    updatedAt: Date.now(),
    updatedBy: 'system',
    version: 1
  }
}

export const permissions = {
  CONFIG_EDIT: [Role.ADMIN],
  REOPEN_FORCE: [Role.ADMIN, Role.MANAGER],
  EXPORT_ADVANCED: [Role.ADMIN, Role.MANAGER, Role.REVIEWER],
  SEVERITY_CHANGE: [Role.ADMIN, Role.MANAGER, Role.REVIEWER],
  STORAGE_MANAGE: [Role.ADMIN],
  SYNC_MANUAL: [Role.ADMIN, Role.MANAGER]
}

export class RuntimeConfigService {
  constructor(storage, initial = defaultRuntimeConfig) {
    this.storage = storage
    this.config = JSON.parse(JSON.stringify(initial))
    this.listeners = new Set()
    this.currentUser = { id: 'u-default', name: '当前用户', role: Role.MEMBER }
  }

  async load() {
    try {
      const saved = await this.storage?.getConfig?.()
      if (saved && saved._meta) {
        this.config = { ...this.config, ...saved }
        return { ok: true, fromStorage: true }
      }
    } catch (_) { /* ignore */ }
    return { ok: true, fromStorage: false, usedDefaults: true }
  }

  async save(partialUpdate, actor = this.currentUser) {
    const permOk = this.can(actor.role, 'CONFIG_EDIT')
    if (!permOk) return { ok: false, error: `权限不足，需要: ${permissions.CONFIG_EDIT.join('/')}` }
    const merged = this._deepMerge(this.config, partialUpdate)
    merged._meta = { ...this.config._meta, updatedAt: Date.now(), updatedBy: actor.id, version: (this.config._meta?.version || 0) + 1 }
    const errors = this._validate(merged)
    if (errors.length) return { ok: false, errors }
    this.config = merged
    this._notify()
    try { await this.storage?.setConfig?.(this.config) } catch (_) { /* ignore */ }
    return { ok: true, version: this.config._meta.version }
  }

  get(path, defaultValue = undefined) {
    const keys = path.split('.')
    let cur = this.config
    for (const k of keys) {
      if (cur == null || typeof cur !== 'object') return defaultValue
      cur = cur[k]
    }
    return cur == null ? defaultValue : cur
  }

  setCurrentUser(user) { this.currentUser = user; return this }

  can(role, permission) {
    if (role === Role.ADMIN) return true
    const allowed = permissions[permission] || []
    return allowed.includes(role)
  }

  canForceReopen(actionItem) {
    const allowedRoles = this.get('actionItem.allowForceReopenRole', [Role.ADMIN])
    return allowedRoles.includes(this.currentUser.role)
  }

  subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn) }

  _notify() { this.listeners.forEach(fn => { try { fn(this.config) } catch (_) {} }) }

  _deepMerge(target, source) {
    const out = { ...target }
    Object.keys(source).forEach(k => {
      if (source[k] && typeof source[k] === 'object' && !Array.isArray(source[k])) {
        out[k] = this._deepMerge(out[k] || {}, source[k])
      } else {
        out[k] = source[k]
      }
    })
    return out
  }

  _validate(cfg) {
    const errs = []
    if (cfg.actionItem?.maxReopen < 0) errs.push('maxReopen 不能为负')
    if (cfg.sync?.clockDriftToleranceMs < 0) errs.push('clockDriftToleranceMs 不能为负')
    if (cfg.storage?.localStorageQuotaMB < 1 || cfg.storage?.localStorageQuotaMB > 10) errs.push('localStorageQuotaMB 范围 1~10')
    return errs
  }
}

/* ============================================
   时钟漂移容忍工具
   ============================================ */

export const clockDriftUtils = {
  DEFAULT_TOLERANCE_MS: 5000,
  driftEstimate: 0,
  lastNtpCheckAt: 0,

  setDriftEstimate(ms) {
    this.driftEstimate = ms
    this.lastNtpCheckAt = Date.now()
  },

  nowCorrected() {
    return Date.now() + this.driftEstimate
  },

  withinTolerance(localTs, remoteTs, tolerance = this.DEFAULT_TOLERANCE_MS) {
    return Math.abs((localTs || 0) - (remoteTs || 0)) <= tolerance
  },

  shouldAutoMerge(localVersion, remoteVersion, updatedAtLocal, updatedAtRemote, tolerance = this.DEFAULT_TOLERANCE_MS) {
    if (localVersion === remoteVersion) return 'same'
    if (this.withinTolerance(updatedAtLocal, updatedAtRemote, tolerance)) return 'drift-tolerant'
    if (localVersion > remoteVersion) return 'local-newer'
    if (Math.abs(localVersion - remoteVersion) <= 1 && this.withinTolerance(updatedAtLocal, updatedAtRemote, tolerance * 2)) {
      return 'minor-drift'
    }
    return 'conflict'
  }
}
