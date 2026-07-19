/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack(config) {
    config.module.rules.push({
      test: /scanner-worker\.ts$/,
      use: {
        loader: 'worker-loader',
        options: { filename: 'static/worker/[name].[contenthash].js', publicPath: '/_next/' },
      },
    });
    return config;
  },
  async rewrites() {
    return [
      {
        source: '/zbar/:path*',
        destination: '/zbar/:path*',
      },
    ];
  },
};

export default nextConfig;