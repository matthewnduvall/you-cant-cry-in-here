/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  cacheComponents: true,
  // One id per build, baked into both the browser code and /api/version, so an open app (e.g. an iPhone home-screen
  // app left running) can tell a newer version has been deployed and reload (useAppUpdateCheck)
  env: {
    APP_BUILD_ID: process.env.VERCEL_GIT_COMMIT_SHA || process.env.VERCEL_DEPLOYMENT_ID || `local-${Date.now()}`,
  },
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
