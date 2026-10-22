import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Keep Next from treating a lockfile in a parent folder as the workspace root.
  turbopack: { root: fileURLToPath(new URL('.', import.meta.url)) },
};

export default nextConfig;
