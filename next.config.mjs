/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Tambahkan IP lokal Anda di sini agar diizinkan
    allowedDevOrigins: [
      "localhost:3000",
      "192.168.0.112:3000", // IP yang muncul di error Anda
    ],
  },
};

export default nextConfig;