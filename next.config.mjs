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
};

export default nextConfig;