import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded px-1.5 py-0.5 text-xs font-semibold',
  {
    variants: {
      variant: {
        default: 'bg-[var(--color-brand)]/20 text-[var(--color-brand)]',
        success: 'bg-[var(--color-success)]/20 text-[var(--color-success)]',
        warning: 'bg-[var(--color-warning)]/20 text-[var(--color-warning)]',
        danger: 'bg-[var(--color-danger)]/20 text-[var(--color-danger)]',
        muted: 'bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)]',
        teamA: 'bg-blue-500/20 text-blue-400',
        teamB: 'bg-purple-500/20 text-purple-400',
      },
    },
    defaultVariants: { variant: 'default' },
  },
)

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export const Badge = ({ className, variant, ...props }: BadgeProps) => (
  <span className={cn(badgeVariants({ variant }), className)} {...props} />
)
