import { cn } from '../lib/utils'

const STATUS_STYLES: Record<string, string> = {
  new: 'bg-nha-sky-light text-nha-sky',
  approved: 'bg-green-100 text-green-700',
  declined: 'bg-red-100 text-red-700',
  on_hold: 'bg-amber-100 text-amber-700',
  tracking: 'bg-nha-orange-light text-nha-orange',
  completed: 'bg-green-100 text-green-700',
  consolidated: 'bg-nha-gray-100 text-nha-gray-600',
}

const STATUS_LABELS: Record<string, string> = {
  new: 'New',
  approved: 'Approved',
  declined: 'Declined',
  on_hold: 'On Hold',
  tracking: 'In Progress',
  completed: 'Completed',
  consolidated: 'Consolidated',
}

const ACTION_STYLES: Record<string, string> = {
  approve: 'bg-green-100 text-green-700',
  decline: 'bg-red-100 text-red-700',
  on_hold: 'bg-amber-100 text-amber-700',
}

const SOURCE_STYLES: Record<string, string> = {
  slack: 'bg-purple-100 text-purple-700',
  email: 'bg-blue-100 text-blue-700',
  screenshot: 'bg-nha-orange-light text-nha-orange',
}

interface StatusBadgeProps {
  value: string
  type?: 'status' | 'action' | 'source'
  className?: string
}

export default function StatusBadge({ value, type = 'status', className }: StatusBadgeProps) {
  const styles = type === 'action'
    ? ACTION_STYLES
    : type === 'source'
      ? SOURCE_STYLES
      : STATUS_STYLES
  const style = styles[value] ?? 'bg-nha-gray-100 text-nha-gray-600'
  const label = type === 'status' ? (STATUS_LABELS[value] ?? value) : value

  return (
    <span className={cn(
      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize',
      style,
      className,
    )}>
      {label}
    </span>
  )
}
