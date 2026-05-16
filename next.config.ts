import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Serve the landing page HTML at `/` — runs after middleware, before filesystem
  async rewrites() {
    return {
      beforeFiles: [
        { source: '/', destination: '/raf-national-landing.html' },
      ],
      afterFiles: [],
      fallback: [],
    }
  },

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

  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Allow browsers to cache static assets aggressively
          { key: 'Vary', value: 'Accept-Encoding' },
        ],
      },
      {
        // Next.js static chunks — immutable (hash-named files)
        source: '/_next/static/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ]
  },
}

export default nextConfig
