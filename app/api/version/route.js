// The build this deployment runs (APP_BUILD_ID from next.config.mjs). Open apps compare it with their own
// build to know when a newer version is live (app/hooks/useAppUpdateCheck.js).
export function GET() {
  return Response.json(
    { build: process.env.APP_BUILD_ID || null },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } }
  );
}
