import { getTranslations } from 'next-intl/server';

export default async function HomePage(): Promise<React.ReactElement> {
  const t = await getTranslations('landing');
  return (
    <section className="flex flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">{t('title')}</h1>
      <p className="max-w-md text-muted-foreground">{t('subtitle')}</p>
    </section>
  );
}
