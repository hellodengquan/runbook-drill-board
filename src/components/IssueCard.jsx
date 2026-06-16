import { severityColors, statusConfig, formatDate, isOverdue, getDaysUntilDue, getRootCauseCategory } from '../utils/helpers'

export default function IssueCard({ issue, participants, onEdit, onDelete, onDragStart, onDragEnd }) {
  const severity = severityColors[issue.severity]
  const status = statusConfig[issue.status]
  const assignee = participants.find((p) => p.id === issue.assigneeId)
  const rootCause = issue.rootCause ? getRootCauseCategory(issue.rootCause) : null
  const overdue = isOverdue(issue.dueDate)
  const daysUntil = getDaysUntilDue(issue.dueDate)

  return (
    <div
      className="issue-card"
      draggable
      onDragStart={(e) => onDragStart && onDragStart(e, issue)}
      onDragEnd={onDragEnd}
      data-severity={issue.severity}
      data-status={issue.status}
    >
      <div className="issue-card-header">
        <div className="badges-row">
          <span
            className="severity-badge"
            style={{ backgroundColor: severity.bg, color: severity.text }}
          >
            {severity.label}
          </span>
          {rootCause && (
            <span
              className="root-cause-badge"
              style={{ backgroundColor: rootCause.color + '20', color: rootCause.color }}
            >
              {rootCause.label}
            </span>
          )}
        </div>
        <div className="card-actions">
          <button className="icon-btn" onClick={() => onEdit(issue)} title="编辑">
            ✏️
          </button>
          <button className="icon-btn" onClick={() => onDelete(issue.id)} title="删除">
            🗑️
          </button>
        </div>
      </div>

      <h4 className="issue-title">{issue.title}</h4>

      {issue.description && (
        <p className="issue-description">{issue.description}</p>
      )}

      {issue.affectedSystems && (
        <div className="issue-systems">
          <span className="systems-label">受影响:</span>
          <span className="systems-value">{issue.affectedSystems}</span>
        </div>
      )}

      {issue.impact && (
        <div className="issue-impact">
          <span className="impact-label">影响:</span>
          <span className="impact-value">{issue.impact}</span>
        </div>
      )}

      <div className="issue-card-footer">
        <div className="footer-left">
          {assignee && (
            <span className="assignee">
              👤 {assignee.name}
            </span>
          )}
          {issue.dueDate && (
            <span className={`due-date ${overdue ? 'overdue' : ''}`}>
              📅 {formatDate(issue.dueDate)}
              {daysUntil !== null && (
                <span className="days-until">
                  {overdue
                    ? ` (逾期 ${-daysUntil} 天)`
                    : daysUntil === 0
                    ? ' (今天)'
                    : ` (${daysUntil}天后)`}
                </span>
              )}
            </span>
          )}
        </div>
        {issue.createdAt && (
          <span className="issue-date">
            {formatDate(issue.createdAt)}
          </span>
        )}
      </div>

      {issue.resolution && issue.status === 'resolved' && (
        <div className="resolution-preview">
          <span className="resolution-label">✓ 解决方案:</span>
          <span className="resolution-text">{issue.resolution.substring(0, 50)}{issue.resolution.length > 50 ? '...' : ''}</span>
        </div>
      )}

      <div className="status-indicator" style={{ backgroundColor: status.color }}></div>
    </div>
  )
}
