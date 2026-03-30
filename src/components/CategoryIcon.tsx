import { Bug, Star, Palette, HelpCircle, FileText } from 'lucide-react'
import { cn } from '../lib/utils'

const CATEGORY_CONFIG: Record<string, { icon: typeof Bug; color: string; bg: string }> = {
  bug: { icon: Bug, color: 'text-red-600', bg: 'bg-red-100' },
  feature: { icon: Star, color: 'text-nha-sky', bg: 'bg-nha-sky-light' },
  ux: { icon: Palette, color: 'text-purple-600', bg: 'bg-purple-100' },
  question: { icon: HelpCircle, color: 'text-yellow-600', bg: 'bg-yellow-100' },
}

interface CategoryIconProps {
  category: string
  size?: 'sm' | 'md'
  className?: string
}

export default function CategoryIcon({ category, size = 'md', className }: CategoryIconProps) {
  const config = CATEGORY_CONFIG[category] ?? { icon: FileText, color: 'text-nha-gray-500', bg: 'bg-nha-gray-100' }
  const Icon = config.icon
  const px = size === 'sm' ? 16 : 20
  const padding = size === 'sm' ? 'p-1.5' : 'p-2'

  return (
    <div className={cn('rounded-lg flex items-center justify-center', config.bg, padding, className)}>
      <Icon size={px} className={config.color} />
    </div>
  )
}
