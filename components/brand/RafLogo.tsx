import { RAF_BRAND_NAME, RAF_BRAND_TAGLINE, RAF_LOGO_ALT, RAF_LOGO_SRC } from '@/lib/brand'
import { cn } from '@/lib/utils'

type RafLogoProps = {
  className?: string
  priority?: boolean
  width?: number
  height?: number
  /** White silhouette on dark backgrounds (sidebar, etc.) */
  tone?: 'default' | 'onDark'
}

/** Official RAF National logo image */
export function RafLogo({
  className,
  priority = false,
  width = 200,
  height = 120,
  tone = 'default',
}: RafLogoProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- brand PNG with intrinsic aspect ratio
    <img
      src={RAF_LOGO_SRC}
      alt={RAF_LOGO_ALT}
      width={width}
      height={height}
      decoding="async"
      fetchPriority={priority ? 'high' : undefined}
      className={cn(
        'h-auto w-auto object-contain select-none',
        tone === 'onDark' && 'brightness-0 invert',
        className
      )}
    />
  )
}

type RafBrandProps = {
  className?: string
  logoClassName?: string
  logoTone?: RafLogoProps['tone']
  /** Optional white/card shell behind the logo (e.g. admin sidebar) */
  logoShellClassName?: string
  /** Override tagline row classes */
  taglineClassName?: string
  /** Show Arabic name + RAF NATIONAL tagline beside the logo */
  showWordmark?: boolean
  /** Wordmark on dark (white title) or light (navy title) backgrounds */
  wordmarkTheme?: 'light' | 'dark'
  priority?: boolean
}

/** Logo with optional wordmark — sidebar, login, headers */
export function RafBrand({
  className,
  logoClassName = 'max-h-10 md:max-h-11',
  logoTone = 'default',
  logoShellClassName,
  taglineClassName,
  showWordmark = true,
  wordmarkTheme = 'light',
  priority = false,
}: RafBrandProps) {
  const titleCls =
    wordmarkTheme === 'light'
      ? 'font-heading text-[15px] font-bold tracking-tight text-white'
      : 'font-heading text-[15px] font-bold tracking-tight text-ink'

  const defaultTagline =
    'text-brand font-sans text-[9px] font-semibold tracking-[0.22em] uppercase opacity-80'

  const logo = <RafLogo className={logoClassName} priority={priority} tone={logoTone} />

  return (
    <div className={cn('flex items-center gap-3', className)}>
      {logoShellClassName ? (
        <div className={cn('flex shrink-0 items-center justify-center', logoShellClassName)}>
          {logo}
        </div>
      ) : (
        logo
      )}
      {showWordmark ? (
        <div className="flex min-w-0 flex-col leading-tight">
          <span className={titleCls}>{RAF_BRAND_NAME}</span>
          <span className={cn(taglineClassName ?? defaultTagline)}>{RAF_BRAND_TAGLINE}</span>
        </div>
      ) : null}
    </div>
  )
}
