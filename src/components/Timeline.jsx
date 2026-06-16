import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { generateTimelineEvents, formatDateTime, severityConfig, actionItemStatusConfig } from '../utils/helpers'

const LOW_END_THROTTLE_MS = 16
const REDUCED_MOTION_THROTTLE_MS = 32
const PASSIVE_OPT = { passive: true }
const NON_PASSIVE_OPT = { passive: false }

const checkReducedMotion = () => {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

export default function Timeline({ scenario, runtimeConfig }) {
  const events = useMemo(() => generateTimelineEvents(scenario), [scenario])
  const containerRef = useRef(null)
  const [viewport, setViewport] = useState({ start: 0, end: Math.min(events.length, 50) })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStartX, setDragStartX] = useState(0)
  const [scrollLeft, setScrollLeft] = useState(0)
  const [zoom, setZoom] = useState(1)
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [reducedMotion, setReducedMotion] = useState(() => checkReducedMotion())

  const touchState = useRef({
    startX: 0, startY: 0, initialDist: 0, initialZoom: 1,
    startScroll: 0, startTime: 0, startViewport: { start: 0, end: Math.min(events.length, 50) },
    moved: false, rafPending: false, lastAppliedAt: 0
  })
  const rafRef = useRef(0)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handler = (e) => setReducedMotion(e.matches)
    if (mql.addEventListener) {
      mql.addEventListener('change', handler)
      return () => mql.removeEventListener('change', handler)
    } else if (mql.addListener) {
      mql.addListener(handler)
      return () => mql.removeListener(handler)
    }
  }, [])

  const enableTouchOpt = runtimeConfig?.timeline?.enableTouchOptimization !== false
  const baseThrottle = runtimeConfig?.timeline?.androidLowEndThrottleMs ?? LOW_END_THROTTLE_MS
  const respectReducedMotion = runtimeConfig?.timeline?.respectReducedMotion !== false
  const throttleMs = respectReducedMotion && reducedMotion
    ? Math.max(baseThrottle, REDUCED_MOTION_THROTTLE_MS)
    : baseThrottle
  const usePassive = runtimeConfig?.timeline?.passiveEvents !== false
  const smoothAnimations = !reducedMotion

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

  const applyTouchUpdate = useCallback((dx, pinchScale) => {
    if (!containerRef.current) return
    const el = containerRef.current
    const targetScroll = Math.max(0, touchState.current.startScroll - dx * zoom)
    el.scrollLeft = targetScroll
    setScrollLeft(targetScroll)

    if (pinchScale && pinchScale !== touchState.current.initialZoom) {
      const nextZoom = Math.min(4, Math.max(0.5, pinchScale))
      setZoom(nextZoom)
    }

    const eventStep = Math.max(1, Math.round(120 / zoom))
    const offsetEvents = Math.round(targetScroll / eventStep)
    const visibleCount = Math.max(20, Math.ceil((el.clientWidth || 800) / eventStep))
    setViewport({
      start: Math.max(0, offsetEvents - 5),
      end: Math.min(events.length, offsetEvents + visibleCount + 5)
    })
  }, [zoom, events.length])

  const scheduleRafUpdate = useCallback((dx, pinchScale) => {
    const now = Date.now()
    if (!enableTouchOpt) {
      applyTouchUpdate(dx, pinchScale)
      return
    }
    if (now - touchState.current.lastAppliedAt < throttleMs) {
      if (touchState.current.rafPending) return
    }
    touchState.current.rafPending = true
    touchState.current.lastAppliedAt = now
    if (typeof requestAnimationFrame === 'function') {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(() => {
        applyTouchUpdate(dx, pinchScale)
        touchState.current.rafPending = false
      })
    } else {
      applyTouchUpdate(dx, pinchScale)
      touchState.current.rafPending = false
    }
  }, [applyTouchUpdate, enableTouchOpt, throttleMs])

  const onTouchStart = useCallback((e) => {
    if (e.touches.length === 1) {
      const t = e.touches[0]
      touchState.current = {
        startX: t.clientX, startY: t.clientY, initialDist: 0, initialZoom: zoom,
        startScroll: scrollLeft, startTime: Date.now(),
        startViewport: { ...viewport }, moved: false, rafPending: false, lastAppliedAt: 0
      }
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      touchState.current.initialDist = Math.sqrt(dx * dx + dy * dy)
      touchState.current.initialZoom = zoom
    }
  }, [zoom, scrollLeft, viewport])

  const onTouchMove = useCallback((e) => {
    const ts = touchState.current
    if (!ts || ts.startTime === 0) return

    if (e.touches.length === 1 && ts.initialDist === 0) {
      const t = e.touches[0]
      const dx = t.clientX - ts.startX
      const dy = t.clientY - ts.startY
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) ts.moved = true
      if (Math.abs(dx) >= Math.abs(dy) && usePassive === false) {
        try { e.preventDefault() } catch (_) { /* noop */ }
      }
      scheduleRafUpdate(dx, null)
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (ts.initialDist > 0) {
        const scale = ts.initialZoom * (dist / ts.initialDist)
        scheduleRafUpdate(0, scale)
      }
      ts.moved = true
    }
  }, [scheduleRafUpdate, usePassive])

  const onTouchEnd = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = 0
    }
    touchState.current.rafPending = false
  }, [])

  useEffect(() => {
    const el = containerRef.current
    if (!el || !enableTouchOpt) return
    const opt = usePassive ? PASSIVE_OPT : NON_PASSIVE_OPT
    el.addEventListener('touchstart', onTouchStart, opt)
    el.addEventListener('touchmove', onTouchMove, opt)
    el.addEventListener('touchend', onTouchEnd, PASSIVE_OPT)
    el.addEventListener('touchcancel', onTouchEnd, PASSIVE_OPT)
    return () => {
      el.removeEventListener('touchstart', onTouchStart, opt)
      el.removeEventListener('touchmove', onTouchMove, opt)
      el.removeEventListener('touchend', onTouchEnd, PASSIVE_OPT)
      el.removeEventListener('touchcancel', onTouchEnd, PASSIVE_OPT)
    }
  }, [onTouchStart, onTouchMove, onTouchEnd, enableTouchOpt, usePassive])

  const onEventTap = (ev, event) => {
    const moved = touchState.current.moved
    if (moved) return
    if (Date.now() - (touchState.current.startTime || 0) > 300) return
    setSelectedEvent(selectedEvent?.id === event.id ? null : event)
  }

  const onMouseDown = (e) => {
    setIsDragging(true)
    setDragStartX(e.clientX)
  }
  const onMouseMove = (e) => {
    if (!isDragging || !containerRef.current) return
    const dx = e.clientX - dragStartX
    containerRef.current.scrollLeft = scrollLeft - dx
  }
  const onMouseUp = () => setIsDragging(false)

  const totalDuration = events.length > 1
    ? Math.round((new Date(events[events.length - 1].time) - new Date(events[0].time)) / 60000)
    : 0

  const visibleEvents = getVisibleEvents()
  const offsetX = Math.max(0, viewport.start) * 120 * zoom

  return (
    <div className="timeline-wrapper">
      <div className="timeline-header">
        <div className="timeline-title">
          <span>📅 时间轴视图</span>
          <span className="timeline-zoom-indicator">缩放: {zoom.toFixed(1)}×</span>
          <span className="timeline-meta">{events.length} 事件 / {totalDuration} 分钟</span>
          <span className={`timeline-status ${enableTouchOpt ? 'ok' : 'default'}`}>
            {enableTouchOpt ? '移动端优化已启用' : '移动端优化已禁用'}
          </span>
        </div>
        <div className="timeline-controls">
          <button className="tl-btn" onClick={() => setZoom(z => Math.max(0.5, +(z - 0.2).toFixed(2)))}>－</button>
          <button className="tl-btn" onClick={() => setZoom(z => Math.min(4, +(z + 0.2).toFixed(2)))}>＋</button>
          <button className="tl-btn" onClick={() => setViewport({ start: 0, end: Math.min(events.length, 50) })}>回到开始</button>
        </div>
      </div>

      <div className="timeline-mobile-hint">
        💡 移动端：横向滑动滚动，双指捏合缩放
      </div>

      <div
        ref={containerRef}
        className={`timeline-container ${isDragging ? 'dragging' : ''}`}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onScroll={(e) => {
          const sl = e.target.scrollLeft
          setScrollLeft(sl)
          const eventStep = Math.max(1, Math.round(120 / zoom))
          const offsetEvents = Math.round(sl / eventStep)
          const visibleCount = Math.max(20, Math.ceil((e.target.clientWidth || 800) / eventStep))
          setViewport({
            start: Math.max(0, offsetEvents - 5),
            end: Math.min(events.length, offsetEvents + visibleCount + 5)
          })
        }}
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      >
        <svg
          className="timeline-svg"
          width={Math.max(800, events.length * 120 * zoom + 100)}
          height={280}
        >
          <defs>
            <linearGradient id="tlGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#6366f1" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.25" />
            </linearGradient>
          </defs>
          <rect x="0" y="140" width="100%" height="4" fill="url(#tlGrad)" rx="2" />
          {visibleEvents.map((event, relIdx) => {
            const idx = viewport.start + relIdx
            const x = offsetX + relIdx * 120 * zoom + 60
            const yTop = 60 + ((idx % 3) * 20)
            const yBottom = 200 - ((idx % 2) * 20)
            const isTop = idx % 2 === 0
            const cy = isTop ? yTop + 30 : yBottom
            const lineY1 = isTop ? yTop + 60 : 140
            return (
              <g key={event.id} transform={`translate(${x}, 0)`} style={{ cursor: 'pointer' }}
                 onClick={(e) => onEventTap(e, event)}>
                <line x1="0" y1={lineY1} x2="0" y2="140" stroke="#cbd5e1" strokeWidth="2" />
                <circle cx="0" cy="140" r="9" fill="#fff" stroke="#6366f1" strokeWidth="3" />
                <circle cx="0" cy="140" r="4" fill="#6366f1" />
                <g transform={`translate(-60, ${isTop ? 0 : 160})`}>
                  <rect x="0" y={isTop ? 0 : 0} width="120" height="58" rx="8"
                        fill={getEventColor(event)} stroke={selectedEvent?.id === event.id ? '#6366f1' : '#d1d5db'}
                        strokeWidth={selectedEvent?.id === event.id ? 2 : 1} />
                  <text x="60" y="20" textAnchor="middle" fontSize="18">{getEventIcon(event)}</text>
                  <text x="60" y="40" textAnchor="middle" fontSize="10" fill="#475569"
                        style={{ pointerEvents: 'none' }}>
                    {(event.title || event.type).slice(0, 14)}
                  </text>
                  <text x="60" y="52" textAnchor="middle" fontSize="9" fill="#94a3b8">
                    {formatDateTime(event.time).slice(5, 16)}
                  </text>
                </g>
                <circle cx="0" cy={cy - 100} r="0" />
              </g>
            )
          })}
        </svg>
      </div>

      {selectedEvent && (
        <div className="timeline-detail-card" onClick={() => setSelectedEvent(null)}>
          <div className="timeline-detail-inner" onClick={e => e.stopPropagation()}>
            <div className="timeline-detail-header">
              <strong>{getEventIcon(selectedEvent)} {(selectedEvent.title || selectedEvent.type)}</strong>
              <button className="close-x" onClick={() => setSelectedEvent(null)}>×</button>
            </div>
            <div className="timeline-detail-body">
              <div><span className="muted">时间：</span>{formatDateTime(selectedEvent.time)}</div>
              <div><span className="muted">类型：</span>{selectedEvent.type}</div>
              {selectedEvent.severity && <div><span className="muted">严重度：</span>{severityConfig[selectedEvent.severity]?.label || selectedEvent.severity}</div>}
              {selectedEvent.description && <div className="mt8"><span className="muted">描述：</span>{selectedEvent.description}</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
