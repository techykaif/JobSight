/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // We use App Router by default in Next.js 13+
  serverExternalPackages: ['pdf-parse', 'mammoth'],
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      '.js': ['.ts', '.tsx', '.js'],
      '.jsx': ['.tsx', '.jsx']
    };
    return config;
  }
};

export default nextConfig;
