import type { Metadata } from 'next'
import { El_Messiri } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/sonner'

const elMessiri = El_Messiri({
  variable: '--font-el-messiri',
  subsets: ['arabic', 'latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  adjustFontFallback: true,
  fallback: ['system-ui', 'Segoe UI', 'Tahoma', 'sans-serif'],
})

export const metadata: Metadata = {
  title: 'راف الوطنية — إدارة عملاء التمويل العقاري',
  description: 'منصة CRM لإدارة عملاء التمويل العقاري ومبيعات شركة راف الوطنية للتطوير والاستثمار العقاري',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ar" dir="rtl" className={`${elMessiri.variable} h-full antialiased`}>
      <body className="bg-background text-foreground flex min-h-full flex-col">
        {children}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  )
}
