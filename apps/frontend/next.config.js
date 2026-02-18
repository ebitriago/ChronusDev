/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone', // Para Docker deploy
  devIndicators: {
    buildActivity: true,
  },
  async rewrites() {
    // Use localhost for local dev, Docker hostname for container
    const backendUrl = process.env.CHRONUSDEV_BACKEND_URL || 'http://localhost:3001';
    return [
      {
        source: '/api/socket.io/:path*',
        destination: `${backendUrl}/socket.io/:path*`, // Proxy Socket.io with /api prefix
      },
      {
        source: '/socket.io/:path*',
        destination: `${backendUrl}/socket.io/:path*`, // Proxy Socket.io standard path
      },
      {
        source: '/api/:path*',
        destination: `${backendUrl}/:path*`, // Proxy to ChronusDev Backend
      }
    ]
  },
}

module.exports = nextConfig

