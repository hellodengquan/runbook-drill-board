import { actionItemStatusConfig, formatDate, isOverdue, getDaysUntilDue } from '../utils/helpers'

export default function ActionItemCard({
  actionItem,
  participants,
  issues,
  onEdit,
  onDelete,
  onStatusChange
}) {
  const status = actionItemStatusConfig[actionItem.status]
  const assignee = participants.find((p) => p.id === actionItem.assigneeId)
  const linkedIssue = issues.find((i) => i.id === actionItem.issueId)
  const overdue = isOverdue(actionItem.dueDate)
  const daysUntil = getDaysUntilDue(actionItem.dueDate)

  const priorityColors = {
    high: { bg: '#fee2e2', text: '#991b1b' },
    medium: { bg: '#fef08a', text: '#854d0e' },
    low: { bg: '#dcfce7', text: '#166534' }
  }

  const priorityLabels = { high: '高', medium: '中', low: '低' }
  const priority = priorityColors[actionItem.priority] || priorityColors.medium

  const nextStatus = {
    pending: 'in_progress',
    in_progress: 'completed',
    blocked: 'in_progress',
    completed: 'verified',
    verified: 'pending'
  }

  const nextStatusLabel = {
    pending: '开始',
    in_progress: '完成',
    blocked: '继续',
    completed: '验证',
    verified: '重置'
  }

  return (
    <div className="action-item-card" data-status={actionItem.status}>
      <div className="action-item-header">
        <span
          className="status-badge"
          style={{ backgroundColor: status.color + '20', color: status.color }}
        >
          {status.label}
        </span>
        <span
          className="priority-badge"
          style={{ backgroundColor: priority.bg, color: priority.text }}
        >
          P{priorityLabels[actionItem.priority]}
        </span>
      </div>

      <h4 className="action-item-title">{actionItem.title}</h4>

      {actionItem.description && (
        <p className="action-item-desc">{actionItem.description}</p>
      )}

      <div className="action-item-meta">
        {assignee && (
          <span className="meta-item">
            👤 {assignee.name}
          </span>
        )}
        {actionItem.dueDate && (
          <span className={`meta-item ${overdue ? 'overdue' : ''}`}>
            📅 {formatDate(actionItem.dueDate)}
            {daysUntil !== null && (
              <span className="days-until">
                {overdue ? ` (逾期 ${-daysUntil} 天)` : daysUntil === 0 ? ' (今天)' : ` (${daysUntil}天后)`}
              </span>
            )}
          </span>
        )}
        {linkedIssue && (
          <span className="meta-item linked-issue">
            🔗 {linkedIssue.title.substring(0, 15)}
            {linkedIssue.title.length > 15 ? '...' : ''}
          </span>
        )}
      </div>

      {actionItem.notes && (
        <div className="action-item-notes">
          <strong>备注:</strong> {actionItem.notes}
        </div>
      )}

      <div className="action-item-footer">
        <button
          className="status-transition-btn"
          style={{ backgroundColor: status.color }}
          onClick={() => onStatusChange && onStatusChange(actionItem.id, nextStatus[actionItem.status])}
        >
          {nextStatusLabel[actionItem.status]}
        </button>
        <div className="action-item-actions">
          <button className="icon-btn small" onClick={() => onEdit(actionItem)} title="编辑">
            ✏️
          </button>
          <button
            className="icon-btn small"
            onClick={() => onDelete(actionItem.id)}
            title="删除"
          >
            🗑️
          </button>
        </div>
      </div>

      <div className="status-indicator-bar" style={{ backgroundColor: status.color }}></div>
    </div>
  )
}
