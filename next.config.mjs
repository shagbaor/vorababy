/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // The home banner picture is uploaded through a server action (Vercel
  // allows request bodies up to 4.5 MB).
  experimental: {
    serverActions: { bodySizeLimit: '5mb' },
  },
}

export default nextConfig
