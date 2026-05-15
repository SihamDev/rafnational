import type { NextConfig } from 'next'

const securityHeaders: { key: string; value: string }[] = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Vary', value: 'Accept-Encoding' },
]

const nextConfig: NextConfig = {
  // Allow @react-pdf/renderer which uses Node APIs
  serverExternalPackages: ['@react-pdf/renderer'],

  // Compress responses (gzip/brotli) — big win for JS bundles
  compress: true,

  // Increase Server Actions body size limit to 2 MB (for file uploads)
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },

  // Security headers + (prod only) immutable static cache — avoids Turbopack dev cache warnings
  async headers() {
    const base: { source: string; headers: { key: string; value: string }[] }[] = [
      { source: '/(.*)', headers: [...securityHeaders] },
    ]

    if (process.env.NODE_ENV === 'production') {
      base.push({
        source: '/_next/static/(.*)',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      })
    }

    return base
  },
}

export default nextConfig
