import { actionItemStatusConfig } from '../utils/helpers'
import ActionItemCard from './ActionItemCard'

export default function ActionItemsPanel({
  actionItems,
  participants,
  issues,
  onAddActionItem,
  onEditActionItem,
  onDeleteActionItem,
  onStatusChange
}) {
  const groupedByStatus = {
    pending: actionItems.filter((a) => a.status === 'pending'),
    in_progress: actionItems.filter((a) => a.status === 'in_progress'),
    blocked: actionItems.filter((a) => a.status === 'blocked'),
    completed: actionItems.filter((a) => a.status === 'completed'),
    verified: actionItems.filter((a) => a.status === 'verified')
  }

  const completedCount = groupedByStatus.completed.length + groupedByStatus.verified.length
  const completionRate = actionItems.length > 0
    ? Math.round((completedCount / actionItems.length) * 100)
    : 0

  return (
    <div className="action-items-panel">
      <div className="panel-header">
        <div>
          <h3>Action Items ({actionItems.length})</h3>
          <div className="completion-info">
            <span className="completion-rate">
              完成率: {completionRate}%
            </span>
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{
                  width: `${completionRate}%`,
                  backgroundColor: completionRate === 100 ? '#10b981' : '#6366f1'
                }}
              ></div>
            </div>
          </div>
        </div>
        <button className="add-btn small" onClick={onAddActionItem}>
          + 添加
        </button>
      </div>

      <div className="action-item-columns">
        {Object.entries(groupedByStatus).map(([status, items]) => {
          const config = actionItemStatusConfig[status]
          return (
            <div key={status} className="action-item-column">
              <div className="column-header-mini">
                <span className="column-dot" style={{ backgroundColor: config.color }}></span>
                <span className="column-name">{config.label}</span>
                <span className="count-badge">{items.length}</span>
              </div>
              <div className="column-content-mini">
                {items.length === 0 ? (
                  <div className="empty-mini">—</div>
                ) : (
                  items.map((item) => (
                    <ActionItemCard
                      key={item.id}
                      actionItem={item}
                      participants={participants}
                      issues={issues}
                      onEdit={onEditActionItem}
                      onDelete={onDeleteActionItem}
                      onStatusChange={onStatusChange}
                    />
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
