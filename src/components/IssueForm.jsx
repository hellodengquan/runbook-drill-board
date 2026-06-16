import { useState } from 'react'
import { generateId, rootCauseCategories } from '../utils/helpers'

function getInitialData(issue) {
  return issue
    ? {
        title: issue.title,
        description: issue.description,
        severity: issue.severity,
        status: issue.status,
        assigneeId: issue.assigneeId || '',
        dueDate: issue.dueDate || '',
        rootCause: issue.rootCause || '',
        resolution: issue.resolution || '',
        impact: issue.impact || '',
        affectedSystems: issue.affectedSystems || ''
      }
    : {
        title: '',
        description: '',
        severity: 'medium',
        status: issue?.status || 'todo',
        assigneeId: '',
        dueDate: '',
        rootCause: '',
        resolution: '',
        impact: '',
        affectedSystems: ''
      }
}

export default function IssueForm({ issue, participants, onSubmit, onCancel }) {
  const [formData, setFormData] = useState(() => getInitialData(issue))

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!formData.title.trim()) return

    const now = new Date().toISOString()
    const data = issue
      ? { ...issue, ...formData, updatedAt: now }
      : {
          id: generateId(),
          ...formData,
          createdAt: now,
          updatedAt: now
        }
    onSubmit(data)
  }

  return (
    <form onSubmit={handleSubmit} className="form">
      <div className="form-group">
        <label>问题标题 *</label>
        <input
          type="text"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          placeholder="简要描述问题"
          required
        />
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>严重程度</label>
          <select
            value={formData.severity}
            onChange={(e) => setFormData({ ...formData, severity: e.target.value })}
          >
            <option value="critical">严重 - 系统不可用</option>
            <option value="high">高 - 功能受限</option>
            <option value="medium">中 - 性能下降</option>
            <option value="low">低 - 体验问题</option>
          </select>
        </div>
        <div className="form-group">
          <label>状态</label>
          <select
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
          >
            <option value="todo">待处理</option>
            <option value="in_progress">处理中</option>
            <option value="resolved">已解决</option>
          </select>
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>责任人</label>
          <select
            value={formData.assigneeId}
            onChange={(e) => setFormData({ ...formData, assigneeId: e.target.value })}
          >
            <option value="">未分配</option>
            {participants.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.role || p.department || '成员'})
              </option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>截止日期</label>
          <input
            type="date"
            value={formData.dueDate}
            onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
          />
        </div>
      </div>
      <div className="form-group">
        <label>根因分类</label>
        <select
          value={formData.rootCause}
          onChange={(e) => setFormData({ ...formData, rootCause: e.target.value })}
        >
          <option value="">未分类</option>
          {rootCauseCategories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.label}
            </option>
          ))}
        </select>
      </div>
      <div className="form-group">
        <label>受影响系统</label>
        <input
          type="text"
          value={formData.affectedSystems}
          onChange={(e) => setFormData({ ...formData, affectedSystems: e.target.value })}
          placeholder="例如：订单系统、支付网关"
        />
      </div>
      <div className="form-group">
        <label>业务影响</label>
        <input
          type="text"
          value={formData.impact}
          onChange={(e) => setFormData({ ...formData, impact: e.target.value })}
          placeholder="例如：影响用户下单，每分钟约100单"
        />
      </div>
      <div className="form-group">
        <label>问题描述</label>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="详细描述问题现象、影响范围、重现步骤等..."
          rows={3}
        />
      </div>
      <div className="form-group">
        <label>解决方案</label>
        <textarea
          value={formData.resolution}
          onChange={(e) => setFormData({ ...formData, resolution: e.target.value })}
          placeholder="记录问题的解决方案和修复过程..."
          rows={2}
        />
      </div>
      <div className="form-actions">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          取消
        </button>
        <button type="submit" className="btn btn-primary">
          {issue ? '保存' : '添加'}
        </button>
      </div>
    </form>
  )
}
