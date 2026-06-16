import { useState, useEffect, useRef, useMemo } from 'react'
import { generateTimelineEvents, formatDateTime, severityConfig, actionItemStatusConfig } from '../utils/helpers'

export default function Timeline({ scenario }) {
  const events = useMemo(() => generateTimelineEvents(scenario), [scenario])
  const containerRef = useRef(null)
  const [viewport, setViewport] = useState({ start: 0, end: Math.min(events.length, 50) })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStartX, setDragStartX] = useState(0)
  const [scrollLeft, setScrollLeft] = useState(0)
  const [zoom, setZoom] = useState(1)
  const [selectedEvent, setSelectedEvent] = useState(null)
  const touchState = useRef({
    startX: 0, startY: 0, initialDist: 0, initialZoom: 1,
    startScroll: 0, startTime: 0
  })

  useEffect(() => {
    setViewport({ start: 0, end: Math.min(events.length, 50) })
  }, [events.length])

  const getEventIcon = (event) => {
    switch (event.type) {
      case 'milestone': return '🎯'
      case 'issue': return '🐛'
      case 'action': return '✅'
      case 'escalation': return '⚠️'
      case 'reopen': return '🔄'
      default: return '📌'
    }
  }

  const getEventColor = (event) => {
    if (event.type === 'issue' && event.severity) return severityConfig[event.severity]?.bg || '#e5e7eb'
    if (event.type === 'action' && event.status) return actionItemStatusConfig[event.status]?.color + '20' || '#e5e7eb'
    if (event.type === 'escalation') return '#fef08a'
    if (event.type === 'reopen') return '#fee2e2'
    if (event.type === 'milestone') return '#ede9fe'
    return '#f3f4f6'
  }

  const getVisibleEvents = () => {
    const VIRTUAL_THRESHOLD = 100
    if (events.length <= VIRTUAL_THRESHOLD) return events
    return events.slice(viewport.start, viewport.end + 10)
  }

  const onTouchStart = (e) => {
    if (e.touches.length === 1) {
      const t = e.touches[0]
      touchState.current = {
        startX: t.clientX, startY: t.clientY, initialDist: 0, initialZoom: zoom,
        startScroll: scrollLeft, startTime: Date.now(), startViewport: { ...viewport }
      }
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      touchState.current.initialDist = Math.sqrt(dx * dx + dy * dy)
      touchState.current.initialZoom = zoom
    }
  }

  const onTouchMove = (e) => {
    e.preventDefault()
    if (e.touches.length === 1) {
      const t = e.touches[0]
      const dx = t.clientX - touchState.current.startX
      const dy = t.clientY - touchState.current.startY
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 8) {
        const newZoom = touchState.current.initialZoom
        const container = containerRef.current
        const maxScroll = container ? Math.max(0, container.scrollWidth - container.clientWidth) : 0
        const newScroll = Math.min(maxScroll, Math.max(0, touchState.current.startScroll - dx * newZoom))
        setScrollLeft(newScroll)
        if (container) container.scrollLeft = newScroll
      }
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (touchState.current.initialDist > 0) {
        const ratio = dist / touchState.current.initialDist
        const newZoom = Math.max(0.5, Math.min(2.5, touchState.current.initialZoom * ratio))
        setZoom(newZoom)
      }
    }
  }

  const onTouchEnd = (e) => {
    const touchElapsed = Date.now() - touchState.current.startTime
    const t = e.changedTouches?.[0]
    if (touchElapsed < 300 && t) {
      handleTap(t.clientX, t.clientY)
    }
    touchState.current = { startX: 0, startY: 0, initialDist: 0, initialZoom: 1, startScroll: 0, startTime: 0 }
  }

  const handleTap = (clientX, clientY) => {
    const el = document.elementFromPoint(clientX, clientY)
    const itemEl = el?.closest('.timeline-item')
    if (itemEl && itemEl.dataset.eventId) {
      const event = events.find(ev => ev.id === itemEl.dataset.eventId)
      setSelectedEvent(prev => prev?.id === event?.id ? null : event)
    }
  }

  const onMouseDown = (e) => {
    if (e.button !== 0) return
    setIsDragging(true)
    setDragStartX(e.clientX)
  }

  const onMouseMove = (e) => {
    if (!isDragging) return
    const dx = e.clientX - dragStartX
    const container = containerRef.current
    if (container) container.scrollLeft -= dx
    setDragStartX(e.clientX)
  }

  const onMouseUp = () => setIsDragging(false)

  const handleWheel = (e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      setZoom(prev => Math.max(0.5, Math.min(2.5, prev - e.deltaY * 0.001)))
    }
  }

  const visibleEvents = getVisibleEvents()

  if (events.length === 0) {
    return (
      <div className="timeline-empty">
        <p>暂无时间轴事件</p>
      </div>
    )
  }

  return (
    <div className="timeline-wrapper">
      <div className="timeline-toolbar">
        <button className="tl-btn" onClick={() => setZoom(z => Math.min(2.5, z + 0.1))} title="放大">🔍+</button>
        <button className="tl-btn" onClick={() => setZoom(z => Math.max(0.5, z - 0.1))} title="缩小">🔍-</button>
        <button className="tl-btn" onClick={() => setZoom(1)} title="重置">↺</button>
        <span className="tl-stats">共 {events.length} 个事件{zoom !== 1 ? ` | ${Math.round(zoom * 100)}%` : ''}</span>
      </div>

      <div
        ref={containerRef}
        className={`timeline-container ${isDragging ? 'is-dragging' : ''}`}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onWheel={handleWheel}
        style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}
      >
        <div className="timeline">
          <div className="timeline-line"></div>
          {visibleEvents.map((event, idx) => (
            <div
              key={event.id}
              data-event-id={event.id}
              className={`timeline-item ${idx % 2 === 0 ? 'left' : 'right'} ${selectedEvent?.id === event.id ? 'is-selected' : ''}`}
              style={{ backgroundColor: getEventColor(event) }}
              onClick={() => setSelectedEvent(prev => prev?.id === event.id ? null : event)}
            >
              <div className="timeline-dot">{getEventIcon(event)}</div>
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
      </div>

      {selectedEvent && (
        <div className="timeline-detail-modal" onClick={() => setSelectedEvent(null)}>
          <div className="timeline-detail-content" onClick={e => e.stopPropagation()}>
            <div className="timeline-detail-header">
              <span className="timeline-detail-icon">{getEventIcon(selectedEvent)}</span>
              <h3>{selectedEvent.title}</h3>
              <button className="tl-close" onClick={() => setSelectedEvent(null)}>×</button>
            </div>
            <div className="timeline-detail-meta">
              <div>📅 {formatDateTime(selectedEvent.time)}</div>
              <div>🏷️ 类型: {selectedEvent.type}</div>
              {selectedEvent.severity && (
                <div style={{ color: severityConfig[selectedEvent.severity]?.text }}>
                  ⚠️ 严重度: {severityConfig[selectedEvent.severity]?.label}
                </div>
              )}
            </div>
            {selectedEvent.description && (
              <div className="timeline-detail-desc">{selectedEvent.description}</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
