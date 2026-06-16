import { useState } from 'react'
import { generateId } from '../utils/helpers'

function getInitialData(scenario) {
  return scenario
    ? {
        name: scenario.name,
        description: scenario.description,
        date: scenario.date,
        expectedSlo: scenario.expectedSlo || '',
        actualRto: scenario.actualRto || '',
        objectives: scenario.objectives || []
      }
    : {
        name: '',
        description: '',
        date: new Date().toISOString().split('T')[0],
        expectedSlo: '',
        actualRto: '',
        objectives: []
      }
}

export default function ScenarioForm({ scenario, onSubmit, onCancel }) {
  const [formData, setFormData] = useState(() => getInitialData(scenario))
  const [newObjective, setNewObjective] = useState({ description: '', target: '', actual: '' })

  const addObjective = () => {
    if (!newObjective.description.trim()) return
    setFormData({
      ...formData,
      objectives: [
        ...formData.objectives,
        {
          id: generateId(),
          description: newObjective.description,
          target: newObjective.target,
          actual: newObjective.actual,
          achieved: newObjective.actual && newObjective.target
            ? parseFloat(newObjective.actual) >= parseFloat(newObjective.target)
            : null
        }
      ]
    })
    setNewObjective({ description: '', target: '', actual: '' })
  }

  const removeObjective = (id) => {
    setFormData({
      ...formData,
      objectives: formData.objectives.filter((o) => o.id !== id)
    })
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!formData.name.trim()) return

    const data = scenario
      ? { ...scenario, ...formData }
      : {
          id: generateId(),
          ...formData,
          participants: [],
          issues: [],
          actionItems: []
        }
    onSubmit(data)
  }

  return (
    <form onSubmit={handleSubmit} className="form">
      <div className="form-group">
        <label>演练名称 *</label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="例如：数据库故障应急演练"
          required
        />
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>演练日期</label>
          <input
            type="date"
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
          />
        </div>
      </div>
      <div className="form-group">
        <label>演练描述</label>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="描述演练的目标、范围和场景..."
          rows={3}
        />
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>预期 SLO</label>
          <input
            type="text"
            value={formData.expectedSlo}
            onChange={(e) => setFormData({ ...formData, expectedSlo: e.target.value })}
            placeholder="例如：99.9% 可用性"
          />
        </div>
        <div className="form-group">
          <label>实际 RTO</label>
          <input
            type="text"
            value={formData.actualRto}
            onChange={(e) => setFormData({ ...formData, actualRto: e.target.value })}
            placeholder="例如：15 分钟"
          />
        </div>
      </div>

      <div className="form-section">
        <label className="section-label">演练目标</label>
        {formData.objectives.length > 0 && (
          <div className="objectives-list">
            {formData.objectives.map((obj) => (
              <div key={obj.id} className="objective-item">
                <div className="objective-content">
                  <span className="objective-desc">{obj.description}</span>
                  {obj.target && (
                    <span className="objective-target">目标: {obj.target}</span>
                  )}
                  {obj.actual != null && (
                    <span className="objective-actual">
                      实际: {obj.actual}
                      {obj.achieved != null && (
                        <span className={`achievement ${obj.achieved ? 'achieved' : 'not-achieved'}`}>
                          {obj.achieved ? ' ✅ 达成' : ' ❌ 未达成'}
                        </span>
                      )}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  className="remove-btn"
                  onClick={() => removeObjective(obj.id)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="add-objective">
          <input
            type="text"
            value={newObjective.description}
            onChange={(e) => setNewObjective({ ...newObjective, description: e.target.value })}
            placeholder="目标描述，例如：故障切换时间 < 5分钟"
            className="objective-input"
          />
          <input
            type="text"
            value={newObjective.target}
            onChange={(e) => setNewObjective({ ...newObjective, target: e.target.value })}
            placeholder="目标值"
            className="objective-input-small"
          />
          <input
            type="text"
            value={newObjective.actual}
            onChange={(e) => setNewObjective({ ...newObjective, actual: e.target.value })}
            placeholder="实际值"
            className="objective-input-small"
          />
          <button
            type="button"
            className="btn btn-secondary small-btn"
            onClick={addObjective}
          >
            添加
          </button>
        </div>
      </div>

      <div className="form-actions">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          取消
        </button>
        <button type="submit" className="btn btn-primary">
          {scenario ? '保存' : '创建'}
        </button>
      </div>
    </form>
  )
}
