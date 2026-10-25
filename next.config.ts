import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * The extracted artboards are read from disk at request time rather than
   * imported, so nothing in the build graph references them and the serverless
   * bundle would ship without them. Trace them in explicitly, or every mounted
   * screen 404s in production while working perfectly in dev.
   * The demo data and code files (demo-files/) are read the same way.
   */
  outputFileTracingIncludes: {
    "/**": ["./design/screens/**", "./demo-files/**"],
  },
};

export default nextConfig;
