import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin Turbopack to THIS project so the leftover lockfile in the user's
  // home directory doesn't get auto-detected as the workspace root.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
