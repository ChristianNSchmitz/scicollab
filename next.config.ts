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
  /**
   * A post can carry up to four images. The browser scales each to at most
   * 1600 px before sending (components/feed/ImagePicker.tsx), so four fit
   * well under this; Vercel itself refuses request bodies over 4.5 MB.
   */
  experimental: {
    serverActions: { bodySizeLimit: "4mb" },
  },
};

export default nextConfig;
