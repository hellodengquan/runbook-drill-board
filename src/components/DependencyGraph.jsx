import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { generateDependencyGraph, severityConfig, statusConfig, actionItemStatusConfig } from '../utils/helpers'

export default function DependencyGraph({ scenario }) {
  const graphData = useMemo(() => generateDependencyGraph(scenario, { enableOptimization: true }), [scenario])
  const [hoveredNode, setHoveredNode] = useState(null)
  const [selectedNode, setSelectedNode] = useState(null)
  const [useClustered, setUseClustered] = useState(graphData.clustered)
  const svgRef = useRef(null)
  const panState = useRef({ startX: 0, startY: 0, viewBoxX: 0, viewBoxY: 0 })
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, w: 800, h: 550 })
  const [isPanning, setIsPanning] = useState(false)
  const touchRef = useRef({ pinchDist: 0, initialView: null })

  const displayData = useMemo(() => {
    if (useClustered && !graphData.clustered) return graphData
    if (!useClustered && graphData.clustered) {
      return generateDependencyGraph(scenario, { enableOptimization: false })
    }
    return graphData
  }, [useClustered, graphData, scenario])

  const { nodes, links, svgWidth = 800, svgHeight = 500 } = displayData
  const viewBoxRef = useRef(viewBox)
  viewBoxRef.current = viewBox

  useEffect(() => {
    const padding = 40
    setViewBox({ x: -padding, y: -padding, w: svgWidth + padding * 2, h: svgHeight + padding * 2 })
  }, [svgWidth, svgHeight])

  const getNodeColor = (node) => {
    if (node.type === 'cluster') {
      const map = { scenario: '#6366f1', participant: '#8b5cf6', issue: '#dc2626', action: '#10b981' }
      return map[node.subType] || '#64748b'
    }
    switch (node.type) {
      case 'scenario': return '#6366f1'
      case 'participant': return '#8b5cf6'
      case 'issue': return severityConfig[node.severity]?.text || '#6b7280'
      case 'action': return actionItemStatusConfig[node.status]?.color || '#6b7280'
      default: return '#6b7280'
    }
  }

  const getNodeBgColor = (node) => {
    if (node.type === 'cluster') return '#f8fafc'
    switch (node.type) {
      case 'scenario': return '#eef2ff'
      case 'participant': return '#f5f3ff'
      case 'issue': return severityConfig[node.severity]?.bg || '#f3f4f6'
      case 'action': return actionItemStatusConfig[node.status]?.color + '15' || '#f3f4f6'
      default: return '#f3f4f6'
    }
  }

  const getLinkColor = (link) => {
    if (link.type === 'cluster-link') return '#94a3b8'
    switch (link.type) {
      case 'participation': return '#a78bfa'
      case 'assignment': return '#3b82f6'
      case 'ownership': return '#10b981'
      case 'action-item': return '#f59e0b'
      case 'issue': return '#ef4444'
      case 'action': return '#8b5cf6'
      default: return '#d1d5db'
    }
  }

  const getNodeSize = (node) => {
    if (node.type === 'cluster') return { w: 180, h: 70 }
    return { w: 140, h: 46 }
  }

  const handleWheel = useCallback((e) => {
    if (!svgRef.current) return
    e.preventDefault()
    const factor = e.deltaY > 0 ? 1.12 : 0.88
    setViewBox(vb => {
      const newW = Math.max(260, Math.min(svgWidth * 3, vb.w * factor))
      const newH = Math.max(180, Math.min(svgHeight * 3, vb.h * factor))
      const rect = svgRef.current.getBoundingClientRect()
      const ratioX = (e.clientX - rect.left) / rect.width
      const ratioY = (e.clientY - rect.top) / rect.height
      const deltaX = (newW - vb.w) * ratioX
      const deltaY = (newH - vb.h) * ratioY
      return { x: vb.x - deltaX, y: vb.y - deltaY, w: newW, h: newH }
    })
  }, [svgWidth, svgHeight])

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    svg.addEventListener('wheel', handleWheel, { passive: false })
    return () => svg.removeEventListener('wheel', handleWheel)
  }, [handleWheel])

  const onSvgMouseDown = (e) => {
    if (e.target.closest('g.node-group')) return
    if (e.button !== 0) return
    setIsPanning(true)
    panState.current = {
      startX: e.clientX,
      startY: e.clientY,
      viewBoxX: viewBox.x,
      viewBoxY: viewBox.y
    }
  }

  const onSvgMouseMove = (e) => {
    if (!isPanning) return
    const rect = svgRef.current.getBoundingClientRect()
    const scaleX = viewBox.w / rect.width
    const scaleY = viewBox.h / rect.height
    const dx = (e.clientX - panState.current.startX) * scaleX
    const dy = (e.clientY - panState.current.startY) * scaleY
    setViewBox(vb => ({ ...vb, x: panState.current.viewBoxX - dx, y: panState.current.viewBoxY - dy }))
  }

  const onSvgMouseUp = () => setIsPanning(false)

  const onTouchStart = (e) => {
    if (e.touches.length === 1) {
      const t = e.touches[0]
      panState.current = { startX: t.clientX, startY: t.clientY, viewBoxX: viewBox.x, viewBoxY: viewBox.y }
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      touchRef.current = { pinchDist: Math.sqrt(dx * dx + dy * dy), initialView: { ...viewBox } }
    }
  }

  const onTouchMove = (e) => {
    if (e.touches.length === 1 && touchRef.current.pinchDist === 0) {
      const t = e.touches[0]
      const rect = svgRef.current.getBoundingClientRect()
      const scaleX = viewBox.w / rect.width
      const scaleY = viewBox.h / rect.height
      const dx = (t.clientX - panState.current.startX) * scaleX
      const dy = (t.clientY - panState.current.startY) * scaleY
      setViewBox(vb => ({ ...vb, x: panState.current.viewBoxX - dx, y: panState.current.viewBoxY - dy }))
    } else if (e.touches.length === 2 && touchRef.current.initialView) {
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      const dist = Math.sqrt(dx * dx + dy * dy)
      const ratio = touchRef.current.pinchDist / dist
      const iv = touchRef.current.initialView
      setViewBox({ ...iv, w: Math.max(260, Math.min(svgWidth * 3, iv.w * ratio)), h: Math.max(180, Math.min(svgHeight * 3, iv.h * ratio)) })
    }
  }

  const onTouchEnd = () => { touchRef.current.pinchDist = 0 }

  const maxVisibleNodes = 1000
  const shouldUseVirtualization = nodes.length > maxVisibleNodes
  const displayedNodes = shouldUseVirtualization ? nodes.slice(0, maxVisibleNodes) : nodes
  const nodeIds = new Set(displayedNodes.map(n => n.id))
  const displayedLinks = shouldUseVirtualization ? links.filter(l => nodeIds.has(l.source) && nodeIds.has(l.target)) : links

  return (
    <div className="dependency-graph">
      <div className="dg-toolbar">
        <label className="dg-toggle">
          <input type="checkbox" checked={useClustered} onChange={e => setUseClustered(e.target.checked)} />
          <span>聚合模式（节点超过50）</span>
        </label>
        <button className="dg-btn" onClick={() => setViewBox({ x: -40, y: -40, w: svgWidth + 80, h: svgHeight + 80 })}>重置视图</button>
        <span className="dg-stats">
          节点 {displayData.stats?.total || nodes.length}
          {displayData.stats?.displayed && displayData.stats.displayed !== displayData.stats.total &&
            ` / 展示 ${displayData.stats.displayed}`}
          {' '}· 连线 {links.length}
        </span>
      </div>

      <svg
        ref={svgRef}
        width="100%"
        height="550"
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
        className={`dg-svg ${isPanning ? 'is-panning' : ''}`}
        onMouseDown={onSvgMouseDown}
        onMouseMove={onSvgMouseMove}
        onMouseUp={onSvgMouseUp}
        onMouseLeave={onSvgMouseUp}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <defs>
          <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="#94a3b8" />
          </marker>
          <pattern id="gridPattern" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#f1f5f9" strokeWidth="1" />
          </pattern>
        </defs>

        <rect x={viewBox.x - 10000} y={viewBox.y - 10000} width={viewBox.w + 20000} height={viewBox.h + 20000} fill="url(#gridPattern)" />

        <g className="links-layer">
          {displayedLinks.map((link, i) => {
            const sn = nodes.find(n => n.id === link.source)
            const tn = nodes.find(n => n.id === link.target)
            if (!sn || !tn) return null
            const ss = getNodeSize(sn)
            const ts = getNodeSize(tn)
            const sx = sn.x, sy = sn.y + ss.h / 2
            const ex = tn.x, ey = tn.y - ts.h / 2
            const cx = (sx + ex) / 2
            const cy = (sy + ey) / 2
            const off = tn.y > sn.y ? 30 : -30
            const isHighlighted = hoveredNode && (link.source === hoveredNode || link.target === hoveredNode)
            const opacity = hoveredNode ? (isHighlighted ? 1 : 0.15) : (link.type === 'action-item' ? 0.5 : 0.65)
            const strokeW = (link.count ? Math.min(4, 1 + Math.log(link.count)) : 2) * (isHighlighted ? 1.5 : 1)
            return (
              <path
                key={`link-${i}`}
                d={`M ${sx} ${sy} Q ${cx} ${cy + off} ${ex} ${ey}`}
                fill="none"
                stroke={getLinkColor(link)}
                strokeWidth={strokeW}
                strokeDasharray={link.type === 'action-item' || link.type === 'cluster-link' ? '4,4' : 'none'}
                markerEnd="url(#arrowhead)"
                opacity={opacity}
              />
            )
          })}
        </g>

        <g className="nodes-layer">
          {displayedNodes.map((node) => {
            const size = getNodeSize(node)
            const isHovered = hoveredNode === node.id
            const isSelected = selectedNode?.id === node.id
            const dimmed = hoveredNode && !isHovered
            return (
              <g
                key={node.id}
                className="node-group"
                transform={`translate(${node.x}, ${node.y})`}
                opacity={dimmed ? 0.3 : 1}
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
                onClick={() => setSelectedNode(prev => prev?.id === node.id ? null : node)}
                style={{ cursor: 'pointer' }}
              >
                <rect
                  x={-size.w / 2}
                  y={-size.h / 2}
                  width={size.w}
                  height={size.h}
                  rx={node.type === 'cluster' ? 12 : 10}
                  fill={getNodeBgColor(node)}
                  stroke={getNodeColor(node)}
                  strokeWidth={isSelected ? 3 : (isHovered ? 2.5 : 2)}
                />
                {node.type === 'cluster' && (
                  <rect
                    x={-size.w / 2 + 2}
                    y={-size.h / 2 + 2}
                    width={size.w - 4}
                    height={10}
                    rx={8}
                    fill={getNodeColor(node)}
                    opacity={0.15}
                  />
                )}
                <text
                  x={0} y={node.type === 'cluster' ? -14 : -4}
                  textAnchor="middle"
                  fontSize={10}
                  fill="#9ca3af"
                >
                  {node.type === 'cluster'
                    ? (node.subType === 'scenario' ? '场景' : node.subType === 'participant' ? '人员' : node.subType === 'issue' ? '问题' : 'Action')
                    : (node.type === 'scenario' ? '演练' : node.type === 'participant' ? '人员' : node.type === 'issue' ? '问题' : 'Action')}
                </text>
                <text
                  x={0} y={node.type === 'cluster' ? 12 : 8}
                  textAnchor="middle"
                  fontSize={node.type === 'cluster' ? 14 : 12}
                  fontWeight={isSelected ? 700 : 500}
                  fill={getNodeColor(node)}
                >
                  {node.label}
                </text>
                {node.count != null && (
                  <text x={size.w / 2 - 10} y={-size.h / 2 + 14} textAnchor="end" fontSize="9" fill="#94a3b8">
                    {node.count}项
                  </text>
                )}
              </g>
            )
          })}
        </g>
      </svg>

      {selectedNode && (
        <div className="dg-tooltip" onClick={() => setSelectedNode(null)}>
          <div className="dg-tooltip-inner" onClick={e => e.stopPropagation()}>
            <h4>{selectedNode.fullLabel || selectedNode.label}</h4>
            <div>类型: {selectedNode.type}</div>
            {selectedNode.role && <div>角色: {selectedNode.role}</div>}
            {selectedNode.severity && <div>严重度: {severityConfig[selectedNode.severity]?.label}</div>}
            {selectedNode.status && (
              <div>状态: {(actionItemStatusConfig[selectedNode.status] || statusConfig[selectedNode.status])?.label}</div>
            )}
            {selectedNode.cluster && (
              <div>
                节点数: {selectedNode.count}
                <div style={{ marginTop: 6, fontSize: 12, color: '#64748b' }}>
                  {selectedNode.cluster.children.slice(0, 5).map(c => c.fullLabel || c.label).join('、')}
                  {selectedNode.cluster.children.length > 5 && ` 等${selectedNode.cluster.children.length}项`}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="graph-legend">
        <div className="legend-title">图例</div>
        <div className="legend-items">
          <div className="legend-item"><span className="legend-dot" style={{ backgroundColor: '#6366f1' }}></span><span>演练场景</span></div>
          <div className="legend-item"><span className="legend-dot" style={{ backgroundColor: '#8b5cf6' }}></span><span>参演人员</span></div>
          <div className="legend-item"><span className="legend-dot" style={{ backgroundColor: '#dc2626' }}></span><span>问题</span></div>
          <div className="legend-item"><span className="legend-dot" style={{ backgroundColor: '#10b981' }}></span><span>Action Item</span></div>
        </div>
        <div className="legend-lines">
          <div className="legend-item"><span className="legend-line" style={{ borderColor: '#a78bfa' }}></span><span>参与关系</span></div>
          <div className="legend-item"><span className="legend-line" style={{ borderColor: '#3b82f6' }}></span><span>负责问题</span></div>
          <div className="legend-item"><span className="legend-line dashed" style={{ borderColor: '#f59e0b' }}></span><span>关联 Action</span></div>
        </div>
      </div>
    </div>
  )
}
