import { formatDate } from '../utils/helpers'

export default function ScenarioSidebar({
  scenarios,
  activeScenarioId,
  onSelectScenario,
  onAddScenario,
  onEditScenario,
  onDeleteScenario
}) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h2>演练场景</h2>
        <button className="add-btn" onClick={onAddScenario} title="新建演练">
          +
        </button>
      </div>
      <div className="scenario-list">
        {scenarios.length === 0 ? (
          <div className="empty-scenarios">
            <p>暂无演练场景</p>
            <p className="hint">点击上方 + 创建第一个演练</p>
          </div>
        ) : (
          scenarios.map((scenario) => (
            <div
              key={scenario.id}
              className={`scenario-item ${activeScenarioId === scenario.id ? 'active' : ''}`}
              onClick={() => onSelectScenario(scenario.id)}
            >
              <div className="scenario-info">
                <h3 className="scenario-name">{scenario.name}</h3>
                <p className="scenario-date">{formatDate(scenario.date)}</p>
                {scenario.description && (
                  <p className="scenario-desc">{scenario.description}</p>
                )}
                <div className="scenario-stats">
                  <span>👥 {scenario.participants.length} 人</span>
                  <span>📋 {scenario.issues.length} 问题</span>
                </div>
              </div>
              <div className="scenario-actions">
                <button
                  className="icon-btn small"
                  onClick={(e) => {
                    e.stopPropagation()
                    onEditScenario(scenario)
                  }}
                  title="编辑"
                >
                  ✏️
                </button>
                <button
                  className="icon-btn small"
                  onClick={(e) => {
                    e.stopPropagation()
                    if (confirm('确定要删除这个演练场景吗？相关数据将全部删除。')) {
                      onDeleteScenario(scenario.id)
                    }
                  }}
                  title="删除"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </aside>
  )
}
