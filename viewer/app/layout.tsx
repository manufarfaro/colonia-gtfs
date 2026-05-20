import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { Header } from '@/components/chrome/Header';
import { DisclaimerBanner } from '@/components/chrome/DisclaimerBanner';
import { ThemeProvider } from '@/components/theme/ThemeProvider';
import './globals.css';

export const metadata: Metadata = {
  title: 'colonia-gtfs',
  description: 'Viajes en bus en Colonia del Sacramento',
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
    <html lang={locale} suppressHydrationWarning>
      <body className="min-h-screen flex flex-col">
        <ThemeProvider>
          <NextIntlClientProvider messages={messages}>
            <Header />
            <main className="flex-1">{children}</main>
            <DisclaimerBanner />
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
