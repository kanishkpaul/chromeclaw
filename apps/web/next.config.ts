import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["playwright", "playwright-core"],
  transpilePackages: ["@chromeclaw/agent", "@chromeclaw/browser", "@chromeclaw/shared", "@chromeclaw/evals"]
};

export default nextConfig;
