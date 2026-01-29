/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone', // Para Docker deploy
  devIndicators: {
    buildActivity: true,
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.CRM_BACKEND_INTERNAL_URL || 'http://chronuscrm-backend:3002'}/:path*`, // Proxy to Backend
      },
      {
        source: '/socket.io/:path*',
        destination: `${process.env.CRM_BACKEND_INTERNAL_URL || 'http://chronuscrm-backend:3002'}/socket.io/:path*`, // Proxy Socket.io
      }
    ]
  },
}

module.exports = nextConfig
