import os from 'os'

/** @type {import('next').NextConfig} */

// Dynamically determine all local IPv4 addresses to allow connections in development
const devOrigins = ['10.0.2.2', 'localhost', 'localhost:3000']
const interfaces = os.networkInterfaces()
for (const dev in interfaces) {
  for (const details of interfaces[dev] || []) {
    if (details.family === 'IPv4') {
      devOrigins.push(details.address)
      devOrigins.push(`${details.address}:3000`)
    }
  }
}

const nextConfig = {
  // Do not generate AGENTS.md / CLAUDE.md files into the project.
  agentRules: false,

  // The dev badge would cover the bottom of the UI on a phone.
  devIndicators: false,

  allowedDevOrigins: devOrigins,

  images: {
    unoptimized: true,
  },

  poweredByHeader: false,

  async headers() {
    const common = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      // Camera, microphone, and location scoped to SafeHer self origin.
      { key: 'Permissions-Policy', value: 'geolocation=(self), microphone=(self), camera=(self)' },
    ]
    if (process.env.NODE_ENV === 'production') {
      common.push({ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' })
    }
    return [
      { source: '/:path*', headers: common },
      // API responses can contain personal data: never cache them.
      { source: '/api/:path*', headers: [{ key: 'Cache-Control', value: 'no-store' }] },
    ]
  },
}

export default nextConfig