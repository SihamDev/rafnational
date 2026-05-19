import type { Metadata } from 'next'
import { El_Messiri, Tajawal } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/sonner'

const tajawal = Tajawal({
  subsets: ['arabic', 'latin'],
  weight: ['400', '500', '700', '800', '900'],
  variable: '--font-tajawal',
  display: 'swap',
})

const elMessiri = El_Messiri({
  subsets: ['arabic', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-el-messiri',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'راف الوطنية — إدارة عملاء التمويل العقاري',
  description:
    'منصة CRM لإدارة عملاء التمويل العقاري ومبيعات شركة راف الوطنية للتطوير والاستثمار العقاري',
  icons: {
    icon: '/brand/logo.png',
    apple: '/brand/logo.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${tajawal.variable} ${elMessiri.variable} h-full antialiased`}
    >
      <body className="bg-background text-foreground flex min-h-full flex-col font-sans">
        {children}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  )
}
