import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

const nextConfig: NextConfig = {
  // Standalone output keeps the production Docker image slim — only the
  // server, node_modules used by it, and static assets ship.
  output: 'standalone',
  reactStrictMode: true,
};

export default withNextIntl(nextConfig);
