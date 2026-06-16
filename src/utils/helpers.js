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

export const severityColors = {
  critical: { bg: '#fee2e2', text: '#991b1b', label: '严重' },
  high: { bg: '#fed7aa', text: '#9a3412', label: '高' },
  medium: { bg: '#fef08a', text: '#854d0e', label: '中' },
  low: { bg: '#dcfce7', text: '#166534', label: '低' }
}

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

export const generateDependencyGraph = (scenario) => {
  const nodes = []
  const links = []

  nodes.push({
    id: 'scenario',
    label: '演练场景',
    type: 'scenario',
    x: 250,
    y: 50
  })

  scenario.participants.forEach((p, i) => {
    nodes.push({
      id: `participant-${p.id}`,
      label: p.name,
      type: 'participant',
      role: p.role,
      x: 80 + (i % 3) * 150,
      y: 140
    })
    links.push({
      source: 'scenario',
      target: `participant-${p.id}`,
      type: 'participation'
    })
  })

  scenario.issues.forEach((issue, i) => {
    nodes.push({
      id: `issue-${issue.id}`,
      label: issue.title.substring(0, 15) + (issue.title.length > 15 ? '...' : ''),
      type: 'issue',
      severity: issue.severity,
      status: issue.status,
      x: 80 + (i % 4) * 120,
      y: 260
    })
    if (issue.assigneeId) {
      links.push({
        source: `participant-${issue.assigneeId}`,
        target: `issue-${issue.id}`,
        type: 'assignment'
      })
    } else {
      links.push({
        source: 'scenario',
        target: `issue-${issue.id}`,
        type: 'issue'
      })
    }
  })

  scenario.actionItems.forEach((action, i) => {
    nodes.push({
      id: `action-${action.id}`,
      label: action.title.substring(0, 15) + (action.title.length > 15 ? '...' : ''),
      type: 'action',
      status: action.status,
      x: 80 + (i % 4) * 120,
      y: 380
    })
    if (action.issueId) {
      links.push({
        source: `issue-${action.issueId}`,
        target: `action-${action.id}`,
        type: 'action-item'
      })
    } else {
      links.push({
        source: 'scenario',
        target: `action-${action.id}`,
        type: 'action'
      })
    }
    if (action.assigneeId) {
      links.push({
        source: `participant-${action.assigneeId}`,
        target: `action-${action.id}`,
        type: 'ownership'
      })
    }
  })

  return { nodes, links }
}

export const exportMarkdownReport = (scenario) => {
  const lines = []

  lines.push(`# 应急演练复盘报告: ${scenario.name}`)
  lines.push('')
  lines.push(`**演练日期**: ${formatDate(scenario.date)}`)
  lines.push('')

  if (scenario.description) {
    lines.push('## 演练概述')
    lines.push(scenario.description)
    lines.push('')
  }

  if (scenario.objectives?.length > 0) {
    lines.push('## 演练目标')
    scenario.objectives.forEach((obj, i) => {
      lines.push(`${i + 1}. ${obj.description}`)
      if (obj.target) {
        lines.push(`   - 目标值: ${obj.target}`)
      }
      if (obj.actual != null) {
        lines.push(`   - 实际值: ${obj.actual}`)
        lines.push(`   - 达成状态: ${obj.achieved ? '✅ 已达成' : '❌ 未达成'}`)
      }
    })
    lines.push('')
  }

  if (scenario.expectedSlo || scenario.actualRto) {
    lines.push('## SLO 与 RTO')
    if (scenario.expectedSlo) {
      lines.push(`- **预期 SLO**: ${scenario.expectedSlo}`)
    }
    if (scenario.actualRto) {
      lines.push(`- **实际 RTO**: ${scenario.actualRto}`)
    }
    lines.push('')
  }

  lines.push('## 参演人员')
  lines.push('')
  lines.push('| 姓名 | 角色 | 部门 | 值班安排 |')
  lines.push('|------|------|------|----------|')
  scenario.participants.forEach((p) => {
    const shift = p.shiftSchedule || '-'
    lines.push(`| ${p.name} | ${p.role || '-'} | ${p.department || '-'} | ${shift} |`)
  })
  lines.push('')

  const todoIssues = scenario.issues.filter((i) => i.status === 'todo')
  const inProgressIssues = scenario.issues.filter((i) => i.status === 'in_progress')
  const resolvedIssues = scenario.issues.filter((i) => i.status === 'resolved')

  lines.push('## 问题统计')
  lines.push('')
  lines.push(`- 总计: ${scenario.issues.length} 个问题`)
  lines.push(`- 待处理: ${todoIssues.length} 个`)
  lines.push(`- 处理中: ${inProgressIssues.length} 个`)
  lines.push(`- 已解决: ${resolvedIssues.length} 个`)
  lines.push(`- 解决率: ${scenario.issues.length > 0 ? Math.round((resolvedIssues.length / scenario.issues.length) * 100) : 0}%`)
  lines.push('')

  if (todoIssues.length > 0) {
    lines.push('### 待处理问题')
    lines.push('')
    lines.push('| 严重程度 | 问题 | 责任人 | 截止日期 |')
    lines.push('|----------|------|--------|----------|')
    todoIssues.forEach((issue) => {
      const assignee = scenario.participants.find((p) => p.id === issue.assigneeId)
      const severity = severityColors[issue.severity]?.label || issue.severity
      const dueDate = issue.dueDate ? formatDate(issue.dueDate) : '-'
      lines.push(`| ${severity} | ${issue.title} | ${assignee?.name || '-'} | ${dueDate} |`)
    })
    lines.push('')
  }

  if (inProgressIssues.length > 0) {
    lines.push('### 处理中问题')
    lines.push('')
    lines.push('| 严重程度 | 问题 | 责任人 | 截止日期 |')
    lines.push('|----------|------|--------|----------|')
    inProgressIssues.forEach((issue) => {
      const assignee = scenario.participants.find((p) => p.id === issue.assigneeId)
      const severity = severityColors[issue.severity]?.label || issue.severity
      const dueDate = issue.dueDate ? formatDate(issue.dueDate) : '-'
      lines.push(`| ${severity} | ${issue.title} | ${assignee?.name || '-'} | ${dueDate} |`)
    })
    lines.push('')
  }

  if (resolvedIssues.length > 0) {
    lines.push('### 已解决问题')
    lines.push('')
    lines.push('| 严重程度 | 问题 | 责任人 | 解决方案 |')
    lines.push('|----------|------|--------|----------|')
    resolvedIssues.forEach((issue) => {
      const assignee = scenario.participants.find((p) => p.id === issue.assigneeId)
      const severity = severityColors[issue.severity]?.label || issue.severity
      const resolution = issue.resolution || '-'
      lines.push(`| ${severity} | ${issue.title} | ${assignee?.name || '-'} | ${resolution} |`)
    })
    lines.push('')
  }

  if (scenario.issues.some((i) => i.rootCause)) {
    lines.push('## 根因分析')
    lines.push('')
    const rootCauseCounts = {}
    scenario.issues.forEach((issue) => {
      if (issue.rootCause) {
        rootCauseCounts[issue.rootCause] = (rootCauseCounts[issue.rootCause] || 0) + 1
      }
    })
    Object.entries(rootCauseCounts).forEach(([category, count]) => {
      const cat = getRootCauseCategory(category)
      lines.push(`- **${cat.label}**: ${count} 个问题`)
    })
    lines.push('')
  }

  if (scenario.actionItems?.length > 0) {
    lines.push('## Action Items')
    lines.push('')
    lines.push('| 状态 | 任务 | 责任人 | 截止日期 |')
    lines.push('|------|------|--------|----------|')
    scenario.actionItems.forEach((action) => {
      const assignee = scenario.participants.find((p) => p.id === action.assigneeId)
      const status = actionItemStatusConfig[action.status]?.label || action.status
      const dueDate = action.dueDate ? formatDate(action.dueDate) : '-'
      lines.push(`| ${status} | ${action.title} | ${assignee?.name || '-'} | ${dueDate} |`)
    })
    lines.push('')

    const completedActions = scenario.actionItems.filter((a) => a.status === 'completed' || a.status === 'verified')
    lines.push(`### Action Item 完成率`)
    lines.push(`${completedActions.length} / ${scenario.actionItems.length} (${
      scenario.actionItems.length > 0
        ? Math.round((completedActions.length / scenario.actionItems.length) * 100)
        : 0
    }%)`)
    lines.push('')
  }

  lines.push('---')
  lines.push(`*报告生成时间: ${formatDateTime(new Date().toISOString())}*`)

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
