import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pure static site — no server actions, route handlers or middleware — so it
  // deploys to Cloudflare Pages as plain files, no adapter. If a backend ever
  // lands *inside* this app, drop this line and use @opennextjs/cloudflare.
  output: "export",
  // Default is bottom-left, which sits on top of the rail's logout button.
  devIndicators: { position: "bottom-right" },
};

export default nextConfig;
