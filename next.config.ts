import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    const droneIds = [0, 1, 2, 3, 4];
    return droneIds.flatMap((id) => [
      {
        source: `/api/position/${id}`,
        destination: `http://192.168.0.74:8000/position/${id}`,
      },
      {
        source: `/api/waypoint/${id}`,
        destination: `http://192.168.0.74:8000/waypoint/${id}`,
      },
      {
        source: `/api/set_pos/${id}`,
        destination: `http://192.168.0.74:8000/set_pos/${id}`,
      },
    ]);
  },
};

export default nextConfig;
