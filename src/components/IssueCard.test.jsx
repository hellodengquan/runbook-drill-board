import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import IssueCard from './IssueCard'

describe('IssueCard', () => {
  const mockIssue = {
    id: 'i1',
    title: '测试问题',
    description: '这是一个测试问题描述',
    severity: 'high',
    status: 'in_progress',
    assigneeId: 'p1',
    dueDate: '2099-06-20',
    rootCause: 'infrastructure',
    affectedSystems: '核心系统',
    impact: '影响用户体验',
    resolution: '',
    createdAt: '2026-06-10T10:30:00Z',
    updatedAt: '2026-06-10T10:30:00Z'
  }

  const mockParticipants = [
    { id: 'p1', name: '测试人', role: '开发' }
  ]

  const defaultProps = {
    issue: mockIssue,
    participants: mockParticipants,
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onDragStart: vi.fn(),
    onDragEnd: vi.fn()
  }

  it('should render issue title and description', () => {
    render(<IssueCard {...defaultProps} />)
    expect(screen.getByText('测试问题')).toBeInTheDocument()
    expect(screen.getByText('这是一个测试问题描述')).toBeInTheDocument()
  })

  it('should display severity badge', () => {
    render(<IssueCard {...defaultProps} />)
    expect(screen.getByText('高')).toBeInTheDocument()
  })

  it('should display root cause category', () => {
    render(<IssueCard {...defaultProps} />)
    expect(screen.getByText('基础设施')).toBeInTheDocument()
  })

  it('should display assignee name', () => {
    render(<IssueCard {...defaultProps} />)
    expect(screen.getByText('👤 测试人')).toBeInTheDocument()
  })

  it('should display due date', () => {
    render(<IssueCard {...defaultProps} />)
    expect(screen.getByText(/📅/)).toBeInTheDocument()
  })

  it('should display affected systems and impact', () => {
    render(<IssueCard {...defaultProps} />)
    expect(screen.getByText('受影响:')).toBeInTheDocument()
    expect(screen.getByText('核心系统')).toBeInTheDocument()
    expect(screen.getByText('影响:')).toBeInTheDocument()
    expect(screen.getByText('影响用户体验')).toBeInTheDocument()
  })

  it('should call onEdit when edit button is clicked', () => {
    render(<IssueCard {...defaultProps} />)
    fireEvent.click(screen.getByTitle('编辑'))
    expect(defaultProps.onEdit).toHaveBeenCalledWith(mockIssue)
  })

  it('should call onDelete when delete button is clicked', () => {
    render(<IssueCard {...defaultProps} />)
    fireEvent.click(screen.getByTitle('删除'))
    expect(defaultProps.onDelete).toHaveBeenCalledWith('i1')
  })

  it('should show overdue style for past due dates', () => {
    const overdueIssue = {
      ...mockIssue,
      dueDate: '2020-01-01'
    }
    render(<IssueCard {...defaultProps} issue={overdueIssue} />)
    const dueDateElement = screen.getByText(/逾期/).closest('.due-date')
    expect(dueDateElement).toHaveClass('overdue')
  })

  it('should display resolution when issue is resolved', () => {
    const resolvedIssue = {
      ...mockIssue,
      status: 'resolved',
      resolution: '已修复问题'
    }
    render(<IssueCard {...defaultProps} issue={resolvedIssue} />)
    expect(screen.getByText(/✓ 解决方案:/)).toBeInTheDocument()
    expect(screen.getByText(/已修复问题/)).toBeInTheDocument()
  })

  it('should handle missing assignee', () => {
    const issueWithoutAssignee = {
      ...mockIssue,
      assigneeId: null
    }
    render(<IssueCard {...defaultProps} issue={issueWithoutAssignee} />)
    expect(screen.queryByText('👤')).not.toBeInTheDocument()
  })

  it('should handle missing root cause', () => {
    const issueWithoutRootCause = {
      ...mockIssue,
      rootCause: null
    }
    render(<IssueCard {...defaultProps} issue={issueWithoutRootCause} />)
    expect(screen.queryByText('基础设施')).not.toBeInTheDocument()
  })

  it('should call onDragStart when dragging starts', () => {
    render(<IssueCard {...defaultProps} />)
    const card = screen.getByText('测试问题').closest('.issue-card')
    fireEvent.dragStart(card)
    expect(defaultProps.onDragStart).toHaveBeenCalled()
  })

  it('should call onDragEnd when dragging ends', () => {
    render(<IssueCard {...defaultProps} />)
    const card = screen.getByText('测试问题').closest('.issue-card')
    fireEvent.dragEnd(card)
    expect(defaultProps.onDragEnd).toHaveBeenCalled()
  })
})
