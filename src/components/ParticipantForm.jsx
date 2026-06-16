import { useState } from 'react'
import { generateId } from '../utils/helpers'

function getInitialData(participant) {
  return participant
    ? {
        name: participant.name,
        role: participant.role || '',
        department: participant.department || '',
        shiftSchedule: participant.shiftSchedule || '',
        phone: participant.phone || '',
        email: participant.email || ''
      }
    : {
        name: '',
        role: '',
        department: '',
        shiftSchedule: '',
        phone: '',
        email: ''
      }
}

export default function ParticipantForm({ participant, onSubmit, onCancel }) {
  const [formData, setFormData] = useState(() => getInitialData(participant))

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!formData.name.trim()) return

    const data = participant
      ? { ...participant, ...formData }
      : { id: generateId(), ...formData }
    onSubmit(data)
  }

  return (
    <form onSubmit={handleSubmit} className="form">
      <div className="form-group">
        <label>姓名 *</label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="请输入姓名"
          required
        />
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>角色</label>
          <input
            type="text"
            value={formData.role}
            onChange={(e) => setFormData({ ...formData, role: e.target.value })}
            placeholder="例如：总指挥、技术支持"
          />
        </div>
        <div className="form-group">
          <label>部门</label>
          <input
            type="text"
            value={formData.department}
            onChange={(e) => setFormData({ ...formData, department: e.target.value })}
            placeholder="例如：运维部"
          />
        </div>
      </div>
      <div className="form-group">
        <label>值班安排</label>
        <input
          type="text"
          value={formData.shiftSchedule}
          onChange={(e) => setFormData({ ...formData, shiftSchedule: e.target.value })}
          placeholder="例如：主班 9:00-18:00，备班 18:00-次日9:00"
        />
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>联系电话</label>
          <input
            type="tel"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            placeholder="应急联系电话"
          />
        </div>
        <div className="form-group">
          <label>邮箱</label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="工作邮箱"
          />
        </div>
      </div>
      <div className="form-actions">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          取消
        </button>
        <button type="submit" className="btn btn-primary">
          {participant ? '保存' : '添加'}
        </button>
      </div>
    </form>
  )
}
