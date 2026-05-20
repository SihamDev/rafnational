import Link from 'next/link'
import { RAF_BRAND_NAME, RAF_BRAND_TAGLINE, RAF_LOGO_ALT, RAF_LOGO_SRC } from '@/lib/brand'
import { cn } from '@/lib/utils'

type RafLogoProps = {
  className?: string
  priority?: boolean
  width?: number
  height?: number
  /** Override logo path (e.g. white login wordmark PNG) */
  src?: string
  /** White silhouette on dark backgrounds (sidebar, etc.) */
  tone?: 'default' | 'onDark'
}

/** Official RAF National logo image */
export function RafLogo({
  className,
  priority = false,
  width = 200,
  height = 120,
  src = RAF_LOGO_SRC,
  tone = 'default',
}: RafLogoProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- brand PNG with intrinsic aspect ratio
    <img
      src={src}
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
  logoSrc?: string
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
  /** When set, the logo is clickable and navigates here (e.g. funnel landing) */
  logoHref?: string
}

/** Logo with optional wordmark — sidebar, login, headers */
export function RafBrand({
  className,
  logoClassName = 'max-h-10 md:max-h-11',
  logoSrc,
  logoTone = 'default',
  logoShellClassName,
  taglineClassName,
  showWordmark = true,
  wordmarkTheme = 'light',
  priority = false,
  logoHref,
}: RafBrandProps) {
  const titleCls =
    wordmarkTheme === 'light'
      ? 'font-heading text-[15px] font-bold tracking-tight text-white'
      : 'font-heading text-[15px] font-bold tracking-tight text-ink'

  const defaultTagline =
    'text-brand font-sans text-[9px] font-semibold tracking-[0.22em] uppercase opacity-80'

  const logoImg = (
    <RafLogo className={logoClassName} priority={priority} src={logoSrc} tone={logoTone} />
  )

  const logo = logoHref ? (
    <Link
      href={logoHref}
      className="focus-visible:ring-brand/50 inline-flex shrink-0 transition-opacity hover:opacity-90 focus-visible:rounded-lg focus-visible:ring-2 focus-visible:outline-none"
      aria-label="الانتقال إلى صفحة الهبوط"
    >
      {logoImg}
    </Link>
  ) : (
    logoImg
  )

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
