/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone', // Para Docker deploy
  experimental: {
    outputFileTracingRoot: require('path').join(__dirname, '../../'),
  },
  devIndicators: {
    buildActivity: true,
  },
  async rewrites() {
    // Use localhost for local dev, Docker hostname for container
    const backendUrl = process.env.CRM_BACKEND_INTERNAL_URL || process.env.CRM_BACKEND_URL || 'http://localhost:3002';

    if (!backendUrl) {
      console.warn('⚠️ CRM_BACKEND_URL is not set. API rewrites may not work.');
    }
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/:path*`, // Proxy to Backend
      },
      {
        source: '/socket.io/:path*',
        destination: `${backendUrl}/socket.io/:path*`, // Proxy Socket.io
      }
    ]
  },
}

module.exports = nextConfig

