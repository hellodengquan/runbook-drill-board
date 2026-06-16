export default function ParticipantsPanel({
  participants,
  onAddParticipant,
  onEditParticipant,
  onDeleteParticipant
}) {
  return (
    <div className="participants-panel">
      <div className="panel-header">
        <h3>参演人员 ({participants.length})</h3>
        <button className="add-btn small" onClick={onAddParticipant} title="添加人员">
          + 添加
        </button>
      </div>
      <div className="participants-list">
        {participants.length === 0 ? (
          <p className="empty-text">暂无参演人员</p>
        ) : (
          <div className="participants-grid">
            {participants.map((participant) => (
              <div key={participant.id} className="participant-card">
                <div className="participant-avatar">
                  {participant.name.charAt(0)}
                </div>
                <div className="participant-info">
                  <h4>{participant.name}</h4>
                  {participant.role && <p className="role">{participant.role}</p>}
                  {participant.department && (
                    <p className="department">{participant.department}</p>
                  )}
                  {participant.shiftSchedule && (
                    <p className="shift">
                      <span className="shift-icon">⏰</span>
                      {participant.shiftSchedule}
                    </p>
                  )}
                  <div className="contact-info">
                    {participant.phone && (
                      <span className="contact-item" title={participant.phone}>
                        📱 {participant.phone}
                      </span>
                    )}
                    {participant.email && (
                      <span className="contact-item" title={participant.email}>
                        📧 {participant.email}
                      </span>
                    )}
                  </div>
                </div>
                <div className="participant-actions">
                  <button
                    className="icon-btn tiny"
                    onClick={() => onEditParticipant(participant)}
                    title="编辑"
                  >
                    ✏️
                  </button>
                  <button
                    className="icon-btn tiny"
                    onClick={() => {
                      if (confirm('确定要删除该人员吗？')) {
                        onDeleteParticipant(participant.id)
                      }
                    }}
                    title="删除"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
