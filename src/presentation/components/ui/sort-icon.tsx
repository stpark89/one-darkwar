import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export type SortDir = 'asc' | 'desc' | null

interface SortIconProps {
  dir: SortDir
  className?: string
}

export const SortIcon = ({ dir, className }: SortIconProps) => {
  if (dir === 'asc') return <ChevronUp className={cn('w-3 h-3 inline-block ml-0.5', className)} />
  if (dir === 'desc') return <ChevronDown className={cn('w-3 h-3 inline-block ml-0.5', className)} />
  return <ChevronsUpDown className={cn('w-3 h-3 inline-block ml-0.5 opacity-30', className)} />
}

export function nextSortDir(current: SortDir, defaultDesc = true): SortDir {
  if (current === null) return defaultDesc ? 'desc' : 'asc'
  if (current === 'desc') return 'asc'
  return null
}
