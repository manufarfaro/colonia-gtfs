import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { Header } from '@/components/chrome/Header';
import { DisclaimerBanner } from '@/components/chrome/DisclaimerBanner';
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
    <html lang={locale}>
      <body className="min-h-screen flex flex-col">
        <NextIntlClientProvider messages={messages}>
          <Header />
          <main className="flex-1">{children}</main>
          <DisclaimerBanner />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
