/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
      "*.csv": {
        loaders: ["./app/data/csvRawLoader.cjs"],
        as: "*.js",
      },
    },
  },
};

export default nextConfig;
