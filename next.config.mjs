/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ['exceljs', 'pdf-lib']
  }
};

export default nextConfig;
