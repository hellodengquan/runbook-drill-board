import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ActionItemCard from './ActionItemCard'

describe('ActionItemCard', () => {
  const mockActionItem = {
    id: 'a1',
    title: '测试Action',
    description: '这是一个测试Action描述',
    status: 'in_progress',
    priority: 'high',
    assigneeId: 'p1',
    issueId: 'i1',
    dueDate: '2099-06-20',
    notes: '需要注意的事项',
    createdAt: '2026-06-10T14:00:00Z',
    updatedAt: '2026-06-10T14:00:00Z',
    completedAt: null
  }

  const mockParticipants = [
    { id: 'p1', name: '测试人', role: '开发' }
  ]

  const mockIssues = [
    { id: 'i1', title: '关联的测试问题' }
  ]

  const defaultProps = {
    actionItem: mockActionItem,
    participants: mockParticipants,
    issues: mockIssues,
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onStatusChange: vi.fn()
  }

  it('should render action item title and description', () => {
    render(<ActionItemCard {...defaultProps} />)
    expect(screen.getByText('测试Action')).toBeInTheDocument()
    expect(screen.getByText('这是一个测试Action描述')).toBeInTheDocument()
  })

  it('should display status badge', () => {
    render(<ActionItemCard {...defaultProps} />)
    expect(screen.getByText('进行中')).toBeInTheDocument()
  })

  it('should display priority badge', () => {
    render(<ActionItemCard {...defaultProps} />)
    expect(screen.getByText('P高')).toBeInTheDocument()
  })

  it('should display assignee name', () => {
    render(<ActionItemCard {...defaultProps} />)
    expect(screen.getByText('👤 测试人')).toBeInTheDocument()
  })

  it('should display due date', () => {
    render(<ActionItemCard {...defaultProps} />)
    expect(screen.getByText(/📅/)).toBeInTheDocument()
  })

  it('should display linked issue', () => {
    render(<ActionItemCard {...defaultProps} />)
    expect(screen.getByText(/🔗 关联的测试问题/)).toBeInTheDocument()
  })

  it('should display notes if present', () => {
    render(<ActionItemCard {...defaultProps} />)
    expect(screen.getByText('备注:')).toBeInTheDocument()
    expect(screen.getByText('需要注意的事项')).toBeInTheDocument()
  })

  it('should show correct status transition button for in_progress', () => {
    render(<ActionItemCard {...defaultProps} />)
    expect(screen.getByText('完成')).toBeInTheDocument()
  })

  it('should show correct status transition button for pending', () => {
    const pendingItem = { ...mockActionItem, status: 'pending' }
    render(<ActionItemCard {...defaultProps} actionItem={pendingItem} />)
    expect(screen.getByText('开始')).toBeInTheDocument()
  })

  it('should show correct status transition button for completed', () => {
    const completedItem = { ...mockActionItem, status: 'completed' }
    render(<ActionItemCard {...defaultProps} actionItem={completedItem} />)
    expect(screen.getByText('验证')).toBeInTheDocument()
  })

  it('should show correct status transition button for blocked', () => {
    const blockedItem = { ...mockActionItem, status: 'blocked' }
    render(<ActionItemCard {...defaultProps} actionItem={blockedItem} />)
    expect(screen.getByText('继续')).toBeInTheDocument()
  })

  it('should show correct status transition button for verified', () => {
    const verifiedItem = { ...mockActionItem, status: 'verified' }
    render(<ActionItemCard {...defaultProps} actionItem={verifiedItem} />)
    expect(screen.getByText('重置')).toBeInTheDocument()
  })

  it('should call onStatusChange when status button is clicked', () => {
    render(<ActionItemCard {...defaultProps} />)
    fireEvent.click(screen.getByText('完成'))
    expect(defaultProps.onStatusChange).toHaveBeenCalledWith('a1', 'completed')
  })

  it('should call onEdit when edit button is clicked', () => {
    render(<ActionItemCard {...defaultProps} />)
    fireEvent.click(screen.getByTitle('编辑'))
    expect(defaultProps.onEdit).toHaveBeenCalledWith(mockActionItem)
  })

  it('should call onDelete when delete button is clicked', () => {
    render(<ActionItemCard {...defaultProps} />)
    fireEvent.click(screen.getByTitle('删除'))
    expect(defaultProps.onDelete).toHaveBeenCalledWith('a1')
  })

  it('should show overdue style for past due dates', () => {
    const overdueItem = {
      ...mockActionItem,
      dueDate: '2020-01-01'
    }
    render(<ActionItemCard {...defaultProps} actionItem={overdueItem} />)
    const dueDateElement = screen.getByText(/逾期/)
    expect(dueDateElement.closest('.meta-item')).toHaveClass('overdue')
  })

  it('should handle missing assignee', () => {
    const itemWithoutAssignee = {
      ...mockActionItem,
      assigneeId: null
    }
    render(<ActionItemCard {...defaultProps} actionItem={itemWithoutAssignee} />)
    expect(screen.queryByText('👤')).not.toBeInTheDocument()
  })

  it('should handle missing linked issue', () => {
    const itemWithoutIssue = {
      ...mockActionItem,
      issueId: null
    }
    render(<ActionItemCard {...defaultProps} actionItem={itemWithoutIssue} />)
    expect(screen.queryByText('🔗')).not.toBeInTheDocument()
  })

  it('should handle missing notes', () => {
    const itemWithoutNotes = {
      ...mockActionItem,
      notes: null
    }
    render(<ActionItemCard {...defaultProps} actionItem={itemWithoutNotes} />)
    expect(screen.queryByText('备注:')).not.toBeInTheDocument()
  })

  it('should use medium priority as default', () => {
    const itemWithUnknownPriority = {
      ...mockActionItem,
      priority: 'unknown'
    }
    render(<ActionItemCard {...defaultProps} actionItem={itemWithUnknownPriority} />)
    expect(screen.getByText('P中')).toBeInTheDocument()
  })
})
