import { cn } from '../lib/utils'

const STATUS_STYLES: Record<string, string> = {
  inbox: 'bg-nha-sky-light text-nha-sky',
  decided: 'bg-nha-blue-light text-nha-blue',
  tracking: 'bg-nha-orange-light text-nha-orange',
  completed: 'bg-green-100 text-green-700',
  declined: 'bg-red-100 text-red-700',
}

const ACTION_STYLES: Record<string, string> = {
  approve: 'bg-green-100 text-green-700',
  decline: 'bg-red-100 text-red-700',
  merge: 'bg-purple-100 text-purple-700',
  discuss: 'bg-yellow-100 text-yellow-700',
  defer: 'bg-nha-gray-100 text-nha-gray-600',
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

  return (
    <span className={cn(
      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize',
      style,
      className,
    )}>
      {value}
    </span>
  )
}
