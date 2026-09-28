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
}

export default nextConfig