import IssueCard from './IssueCard'
import { statusConfig } from '../utils/helpers'

export default function KanbanColumn({
  status,
  issues,
  participants,
  onEditIssue,
  onDeleteIssue,
  onAddIssue,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop
}) {
  const config = statusConfig[status]
  const statusIssues = issues.filter((issue) => issue.status === status)

  return (
    <div
      className="kanban-column"
      onDragOver={onDragOver}
      onDrop={(e) => onDrop(e, status)}
    >
      <div className="column-header">
        <div className="column-title">
          <span className="column-dot" style={{ backgroundColor: config.color }}></span>
          <h3>{config.label}</h3>
          <span className="issue-count">{statusIssues.length}</span>
        </div>
        <button className="add-issue-btn" onClick={() => onAddIssue(status)} title="添加问题">
          +
        </button>
      </div>
      <div className="column-content">
        {statusIssues.length === 0 ? (
          <div className="empty-state">暂无问题</div>
        ) : (
          statusIssues.map((issue) => (
            <IssueCard
              key={issue.id}
              issue={issue}
              participants={participants}
              onEdit={onEditIssue}
              onDelete={onDeleteIssue}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
            />
          ))
        )}
      </div>
    </div>
  )
}
