import type { Metadata, Viewport } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { Fraunces, IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google';
import { Header } from '@/components/chrome/Header';
import { DisclaimerBanner } from '@/components/chrome/DisclaimerBanner';
import { ThemeProvider } from '@/components/theme/ThemeProvider';
import { QueryProvider } from '@/components/providers/QueryProvider';
import './globals.css';

/*
 * Colonia institutional typography.
 *
 * - Fraunces (variable serif): display font for chrome title + headlines.
 *   `opsz` (optical sizing) tuned to UI sizes; `SOFT` axis at default.
 * - IBM Plex Sans (variable sans): body default, multilingual (Latin
 *   Extended-A covers Spanish accents + Portuguese for future locales).
 * - IBM Plex Mono: line codes, stop IDs, scheduled departure times.
 *
 * All three are self-hosted by Next at build time — no runtime DNS to
 * `fonts.googleapis.com`. Subsets: `latin` + `latin-ext`.
 *
 * Variable names match the bindings in `globals.css` `@theme inline`.
 */
const fontDisplay = Fraunces({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-fraunces',
  display: 'swap',
});
const fontBody = IBM_Plex_Sans({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-plex-sans',
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
      className={`${fontDisplay.variable} ${fontBody.variable} ${fontMono.variable}`}
    >
      <body className="min-h-screen flex flex-col font-body antialiased">
        <ThemeProvider>
          <QueryProvider>
            <NextIntlClientProvider locale={locale} messages={messages}>
              <Header />
              <main className="flex-1">{children}</main>
              <DisclaimerBanner />
            </NextIntlClientProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
