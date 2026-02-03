/** @type {import('next').NextConfig} */
const allowedOrigins = ["localhost", "127.0.0.1"];
if (process.env.NEXT_PUBLIC_APP_ORIGIN) {
  allowedOrigins.push(process.env.NEXT_PUBLIC_APP_ORIGIN);
}

const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      allowedOrigins
    }
  },
  async redirects() {
    return [
      {
        source: "/cadastro",
        destination: "/acesso-interno",
        permanent: false
      }
    ];
  }
};

export default nextConfig;
