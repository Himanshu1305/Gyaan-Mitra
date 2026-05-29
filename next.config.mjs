/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["react-markdown"],
  webpack: (config) => {
    // pdfjs-dist tries to require 'canvas' in Node environments; alias it away
    config.resolve.alias.canvas = false;
    return config;
  },
};

export default nextConfig;
