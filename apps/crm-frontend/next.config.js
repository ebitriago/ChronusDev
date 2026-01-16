/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone', // Para Docker deploy
  devIndicators: {
    buildActivity: true,
  },
}

module.exports = nextConfig
