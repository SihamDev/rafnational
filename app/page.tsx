/**
 * Guests hitting `/` are rewritten in middleware to `/raf-national-landing.html`
 * (same URL bar). This file is only used if that rewrite does not run.
 */
export default function HomeFallback() {
  return (
    <p className="text-muted-foreground p-8 text-center text-sm" dir="rtl">
      جاري التحميل… إذا استمرت الشاشة فارغة، حدّث الصفحة أو شغّل <code className="rounded bg-muted px-1">npm run dev</code>
    </p>
  )
}
