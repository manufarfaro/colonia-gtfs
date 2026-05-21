import type { Metadata, Viewport } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { Manrope, IBM_Plex_Mono } from 'next/font/google';
import { Header } from '@/components/chrome/Header';
import { DisclaimerBanner } from '@/components/chrome/DisclaimerBanner';
import { ThemeProvider } from '@/components/theme/ThemeProvider';
import { QueryProvider } from '@/components/providers/QueryProvider';
import './globals.css';

/*
 * Colonia institutional typography.
 *
 * The Intendencia's site (colonia.gub.uy) uses the commercial `Mont`
 * family (Fontfabric). We substitute with `Manrope` — a variable
 * geometric sans (OFL) that captures the same rounded-institutional
 * vibe and is bundleable via next/font.
 *
 * One font (Manrope) serves both display and body via weight axis.
 * IBM Plex Mono carries line codes, stop IDs, scheduled times.
 *
 * Self-hosted at build — no runtime DNS to `fonts.googleapis.com`.
 * Subsets: `latin` + `latin-ext` (Spanish accents + Portuguese future).
 */
const fontManrope = Manrope({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-manrope',
  display: 'swap',
});
const fontMono = IBM_Plex_Mono({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500'],
  variable: '--font-plex-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Colonia Maps · No oficial',
  description:
    'Planificador de viajes en bus para Colonia del Sacramento — basado en datos preliminares, no oficial.',
  applicationName: 'Colonia Maps',
  authors: [{ name: 'Manuel Farfaro' }],
  keywords: ['Colonia', 'Sacramento', 'Uruguay', 'bus', 'transporte', 'GTFS', 'Sol Antigua'],
  icons: {
    icon: [
      { url: '/icons/favicon/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/icons/favicon/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/favicon/favicon-96x96.png', sizes: '96x96', type: 'image/png' },
      { url: '/icons/favicon/android-icon-192x192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/favicon/apple-icon-57x57.png', sizes: '57x57' },
      { url: '/icons/favicon/apple-icon-60x60.png', sizes: '60x60' },
      { url: '/icons/favicon/apple-icon-72x72.png', sizes: '72x72' },
      { url: '/icons/favicon/apple-icon-76x76.png', sizes: '76x76' },
      { url: '/icons/favicon/apple-icon-114x114.png', sizes: '114x114' },
      { url: '/icons/favicon/apple-icon-120x120.png', sizes: '120x120' },
      { url: '/icons/favicon/apple-icon-144x144.png', sizes: '144x144' },
      { url: '/icons/favicon/apple-icon-152x152.png', sizes: '152x152' },
      { url: '/icons/favicon/apple-icon-180x180.png', sizes: '180x180' },
    ],
  },
  appleWebApp: {
    title: 'Colonia Maps',
    capable: true,
    statusBarStyle: 'black-translucent',
  },
  openGraph: {
    title: 'Colonia Maps · No oficial',
    description: 'Planificador de viajes en bus para Colonia del Sacramento.',
    type: 'website',
    locale: 'es_UY',
  },
};

/* Static `theme-color` = the Intendencia cobalt that the chrome
   header also paints. Tints the iOS Safari / Android Chrome status
   bar to the brand from the first frame. */
export const viewport: Viewport = {
  themeColor: '#0084fc',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<React.ReactElement> {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    // suppressHydrationWarning: next-themes mutates <html class> on mount to
    // apply the resolved theme; this attribute tells React to ignore the
    // expected SSR/CSR mismatch on the html element only.
    <html
      lang={locale}
      suppressHydrationWarning
      className={`${fontManrope.variable} ${fontMono.variable}`}
    >
      <body className="min-h-screen flex flex-col font-body antialiased">
        <ThemeProvider>
          <QueryProvider>
            <NextIntlClientProvider locale={locale} messages={messages}>
              <Header />
              <main className="flex-1 relative min-h-0">{children}</main>
              <DisclaimerBanner />
            </NextIntlClientProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
