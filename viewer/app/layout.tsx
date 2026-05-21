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
  title: 'colonia-gtfs',
  description: 'Viajes en bus en Colonia del Sacramento',
};

/* Static `theme-color` = light-mode primary cobalt. Tints the iOS
   Safari / Android Chrome status bar to the brand from the first
   frame. A future change can flip this dynamically by mode. */
export const viewport: Viewport = {
  themeColor: '#0077b5',
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
