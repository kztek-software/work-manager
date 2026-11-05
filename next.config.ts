import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Bắt buộc cho Docker image: sinh ra .next/standalone (server.js + node_modules
  // đã được trace) mà Dockerfile stage `runner` copy vào image production.
  output: "standalone",

  // Ẩn dev indicator badge (nút tròn N) để không che khuất bottom navigation trên mobile
  devIndicators: false,

  typescript: {
    ignoreBuildErrors: true,
  },

  // Cho phép kết nối WebSocket HMR và truy cập từ mọi máy trong mạng nội bộ (LAN / Wi-Fi)
  allowedDevOrigins: [
    "localhost",
    "localhost:3000",
    "127.0.0.1",
    "127.0.0.1:3000",
    "192.168.21.48",
    "192.168.21.48:3000",
    "192.168.*",
    "10.*",
    "172.16.*",
    "*.local",
    "*.lan",
  ],

  // Cấu hình security headers nghiêm ngặt cho tệp tĩnh tải lên chống thực thi mã / XSS / sniffing
  async headers() {
    return [
      {
        source: "/uploads/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Content-Security-Policy", value: "default-src 'none'; sandbox" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default nextConfig;
