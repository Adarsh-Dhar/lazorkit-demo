/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Permissions-Policy",
            // ⚠️ CHANGE THIS: Use '*' instead of '(self)'
            value: "publickey-credentials-get=*, publickey-credentials-create=*" 
          }
        ],
      },
    ];
  },
};

export default nextConfig;