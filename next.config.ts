import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin Turbopack to THIS project so the leftover lockfile in the user's
  // home directory doesn't get auto-detected as the workspace root.
  turbopack: {
    root: path.join(__dirname),
  },
  // Phone photos are often 3–8 MB; the default 1 MB Server Action limit
  // rejects them before our dashboard code runs (shows as "unexpected
  // response" on mobile). Client-side compression is the first line of
  // defence; this raises the server ceiling as a backstop.
  experimental: {
    serverActions: {
      bodySizeLimit: "12mb",
    },
  },
};

export default nextConfig;
