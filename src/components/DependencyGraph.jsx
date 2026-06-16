import { generateDependencyGraph, severityColors, statusConfig, actionItemStatusConfig } from '../utils/helpers'

export default function DependencyGraph({ scenario }) {
  const { nodes, links } = generateDependencyGraph(scenario)

  const getNodeColor = (node) => {
    switch (node.type) {
      case 'scenario':
        return '#6366f1'
      case 'participant':
        return '#8b5cf6'
      case 'issue':
        return severityColors[node.severity]?.text || '#6b7280'
      case 'action':
        return actionItemStatusConfig[node.status]?.color || '#6b7280'
      default:
        return '#6b7280'
    }
  }

  const getNodeBgColor = (node) => {
    switch (node.type) {
      case 'scenario':
        return '#eef2ff'
      case 'participant':
        return '#f5f3ff'
      case 'issue':
        return severityColors[node.severity]?.bg || '#f3f4f6'
      case 'action':
        return actionItemStatusConfig[node.status]?.color + '15' || '#f3f4f6'
      default:
        return '#f3f4f6'
    }
  }

  const getLinkColor = (link) => {
    switch (link.type) {
      case 'participation':
        return '#a78bfa'
      case 'assignment':
        return '#3b82f6'
      case 'ownership':
        return '#10b981'
      case 'action-item':
        return '#f59e0b'
      case 'issue':
        return '#ef4444'
      case 'action':
        return '#8b5cf6'
      default:
        return '#d1d5db'
    }
  }

  const getNodeLabel = (node) => {
    const labels = {
      scenario: '演练场景',
      participant: '人员',
      issue: '问题',
      action: 'Action'
    }
    return labels[node.type] || node.type
  }

  const svgWidth = 600
  const svgHeight = 450

  return (
    <div className="dependency-graph">
      <svg width={svgWidth} height={svgHeight} viewBox={`0 0 ${svgWidth} ${svgHeight}`}>
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill="#9ca3af" />
          </marker>
        </defs>

        {links.map((link, index) => {
          const sourceNode = nodes.find((n) => n.id === link.source)
          const targetNode = nodes.find((n) => n.id === link.target)
          if (!sourceNode || !targetNode) return null

          const midX = (sourceNode.x + targetNode.x) / 2
          const midY = (sourceNode.y + targetNode.y) / 2
          const offset = 20
          const ctrlX = midX + (targetNode.y > sourceNode.y ? offset : -offset)
          const ctrlY = midY

          return (
            <g key={`link-${index}`}>
              <path
                d={`M ${sourceNode.x} ${sourceNode.y + 20} Q ${ctrlX} ${ctrlY} ${targetNode.x} ${targetNode.y - 20}`}
                fill="none"
                stroke={getLinkColor(link)}
                strokeWidth="2"
                strokeDasharray={link.type === 'action-item' ? '4,4' : 'none'}
                markerEnd="url(#arrowhead)"
                opacity="0.6"
              />
            </g>
          )
        })}

        {nodes.map((node) => (
          <g key={node.id} transform={`translate(${node.x}, ${node.y})`}>
            <rect
              x="-60"
              y="-20"
              width="120"
              height="40"
              rx="8"
              fill={getNodeBgColor(node)}
              stroke={getNodeColor(node)}
              strokeWidth="2"
            />
            <text
              x="0"
              y="5"
              textAnchor="middle"
              fontSize="12"
              fontWeight="500"
              fill={getNodeColor(node)}
            >
              {node.label}
            </text>
            <text
              x="0"
              y="-25"
              textAnchor="middle"
              fontSize="10"
              fill="#9ca3af"
            >
              {getNodeLabel(node)}
            </text>
          </g>
        ))}
      </svg>

      <div className="graph-legend">
        <div className="legend-title">图例</div>
        <div className="legend-items">
          <div className="legend-item">
            <span className="legend-dot" style={{ backgroundColor: '#6366f1' }}></span>
            <span>演练场景</span>
          </div>
          <div className="legend-item">
            <span className="legend-dot" style={{ backgroundColor: '#8b5cf6' }}></span>
            <span>参演人员</span>
          </div>
          <div className="legend-item">
            <span className="legend-dot" style={{ backgroundColor: '#ef4444' }}></span>
            <span>问题</span>
          </div>
          <div className="legend-item">
            <span className="legend-dot" style={{ backgroundColor: '#10b981' }}></span>
            <span>Action Item</span>
          </div>
        </div>
        <div className="legend-lines">
          <div className="legend-item">
            <span className="legend-line" style={{ borderColor: '#a78bfa' }}></span>
            <span>参与关系</span>
          </div>
          <div className="legend-item">
            <span className="legend-line" style={{ borderColor: '#3b82f6' }}></span>
            <span>负责问题</span>
          </div>
          <div className="legend-item">
            <span className="legend-line dashed" style={{ borderColor: '#f59e0b' }}></span>
            <span>关联 Action</span>
          </div>
        </div>
      </div>
    </div>
  )
}
