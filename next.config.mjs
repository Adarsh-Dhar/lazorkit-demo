/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Permissions-Policy",
            value: "publickey-credentials-get=(self), publickey-credentials-create=(self)"
          }
        ],
      },
    ];
  },
};

export default nextConfig;