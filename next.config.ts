import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/position",
        destination: "http://192.168.0.74:8000/position",
      },
      {
        source: "/api/waypoint",
        destination: "http://192.168.0.74:8000/waypoint",
      },
    ];
  },
};

export default nextConfig;
