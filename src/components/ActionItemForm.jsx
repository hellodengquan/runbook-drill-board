import { useState } from 'react'
import { generateId } from '../utils/helpers'

function getInitialData(actionItem, issues, defaultStatus) {
  return actionItem
    ? {
        title: actionItem.title,
        description: actionItem.description,
        status: actionItem.status,
        assigneeId: actionItem.assigneeId || '',
        issueId: actionItem.issueId || '',
        dueDate: actionItem.dueDate || '',
        priority: actionItem.priority || 'medium',
        notes: actionItem.notes || ''
      }
    : {
        title: '',
        description: '',
        status: defaultStatus || 'pending',
        assigneeId: '',
        issueId: '',
        dueDate: '',
        priority: 'medium',
        notes: ''
      }
}

export default function ActionItemForm({
  actionItem,
  participants,
  issues,
  defaultStatus,
  onSubmit,
  onCancel
}) {
  const [formData, setFormData] = useState(() =>
    getInitialData(actionItem, issues, defaultStatus)
  )

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!formData.title.trim()) return

    const now = new Date().toISOString()
    const isCompleted = formData.status === 'completed' || formData.status === 'verified'

    const data = actionItem
      ? {
          ...actionItem,
          ...formData,
          completedAt: isCompleted && !actionItem.completedAt ? now : actionItem.completedAt,
          updatedAt: now
        }
      : {
          id: generateId(),
          ...formData,
          createdAt: now,
          updatedAt: now,
          completedAt: isCompleted ? now : null
        }
    onSubmit(data)
  }

  return (
    <form onSubmit={handleSubmit} className="form">
      <div className="form-group">
        <label>任务标题 *</label>
        <input
          type="text"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          placeholder="例如：优化数据库连接池配置"
          required
        />
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>状态</label>
          <select
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
          >
            <option value="pending">待开始</option>
            <option value="in_progress">进行中</option>
            <option value="blocked">已阻塞</option>
            <option value="completed">已完成</option>
            <option value="verified">已验证</option>
          </select>
        </div>
        <div className="form-group">
          <label>优先级</label>
          <select
            value={formData.priority}
            onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
          >
            <option value="high">高</option>
            <option value="medium">中</option>
            <option value="low">低</option>
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
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>关联问题</label>
          <select
            value={formData.issueId}
            onChange={(e) => setFormData({ ...formData, issueId: e.target.value })}
          >
            <option value="">不关联</option>
            {issues.map((issue) => (
              <option key={issue.id} value={issue.id}>
                {issue.title.substring(0, 25)}
                {issue.title.length > 25 ? '...' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="form-group">
        <label>截止日期</label>
        <input
          type="date"
          value={formData.dueDate}
          onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
        />
      </div>
      <div className="form-group">
        <label>任务描述</label>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="详细描述任务内容和预期结果..."
          rows={3}
        />
      </div>
      <div className="form-group">
        <label>备注</label>
        <textarea
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          placeholder="执行过程中的备注信息..."
          rows={2}
        />
      </div>
      <div className="form-actions">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          取消
        </button>
        <button type="submit" className="btn btn-primary">
          {actionItem ? '保存' : '添加'}
        </button>
      </div>
    </form>
  )
}
