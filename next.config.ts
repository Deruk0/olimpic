import type { NextConfig } from "next";
const config: NextConfig = {
  serverExternalPackages: ["pg", "@electric-sql/pglite"],
  outputFileTracingIncludes: { "/*": ["./lib/schema.sql"] },
  experimental: { serverActions: { bodySizeLimit: "28mb" } }
};
export default config;
