/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  basePath: '/CameronRecipes',
  images: {
    unoptimized: true,
  },
  typescript: {
    tsconfigPath: './tsconfig.json',
    ignoreBuildErrors: false,
  },
};

export default nextConfig;

