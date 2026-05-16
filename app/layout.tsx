import type { Metadata } from 'next'
import './globals.css'
import { Toaster } from '@/components/ui/sonner'

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
    <html lang="ar" dir="rtl" className="h-full antialiased">
      <body className="bg-background text-foreground flex min-h-full flex-col">
        {children}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  )
}
