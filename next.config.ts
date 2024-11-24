import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/position/0",
        destination: "http://192.168.0.74:8000/position/0",
        // destination: "http://127.0.0.1:8000/position",
      },
      {
        source: "/api/waypoint/0",
        destination: "http://192.168.0.74:8000/waypoint/0",
      },
    ];
  },
};

export default nextConfig;
