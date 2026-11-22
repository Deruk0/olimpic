import type { NextConfig } from "next";
const config: NextConfig = {
  serverExternalPackages: ["pg", "@electric-sql/pglite"],
  outputFileTracingIncludes: { "/*": ["./lib/schema.sql"] },
  experimental: { serverActions: { bodySizeLimit: "28mb" } },
  async headers() {
    return [{
      source: "/cabinet/:path*",
      headers: [{ key: "X-Robots-Tag", value: "noindex" }],
    }];
  },
};
export default config;
