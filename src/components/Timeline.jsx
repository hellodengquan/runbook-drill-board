import { generateTimelineEvents, formatDateTime, severityColors, actionItemStatusConfig } from '../utils/helpers'

export default function Timeline({ scenario }) {
  const events = generateTimelineEvents(scenario)

  if (events.length === 0) {
    return (
      <div className="timeline-empty">
        <p>暂无时间轴事件</p>
      </div>
    )
  }

  const getEventIcon = (event) => {
    switch (event.type) {
      case 'milestone':
        return '🎯'
      case 'issue':
        return '🐛'
      case 'action':
        return '✅'
      default:
        return '📌'
    }
  }

  const getEventColor = (event) => {
    if (event.type === 'issue' && event.severity) {
      return severityColors[event.severity]?.bg || '#e5e7eb'
    }
    if (event.type === 'action' && event.status) {
      return actionItemStatusConfig[event.status]?.color + '20' || '#e5e7eb'
    }
    if (event.type === 'milestone') {
      return '#ede9fe'
    }
    return '#f3f4f6'
  }

  return (
    <div className="timeline">
      <div className="timeline-line"></div>
      {events.map((event, index) => (
        <div
          key={event.id}
          className={`timeline-item ${index % 2 === 0 ? 'left' : 'right'}`}
          style={{ backgroundColor: getEventColor(event) }}
        >
          <div className="timeline-dot">
            {getEventIcon(event)}
          </div>
          <div className="timeline-content">
            <div className="timeline-time">{formatDateTime(event.time)}</div>
            <div className="timeline-title">{event.title}</div>
            {event.description && (
              <div className="timeline-desc">{event.description}</div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
