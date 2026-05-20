'use client';

import { useTranslations } from 'next-intl';

/**
 * Banner persistente con el disclaimer del v0 (PRD §5.2 — "Datos
 * preliminares · operador no oficial · tarifas a confirmar"). Siempre
 * visible, sin botón de cierre (D-10 del design: disclaimers son
 * ciudadanos de primera, no errores que esconder).
 */
export function DisclaimerBanner(): React.ReactElement {
  const t = useTranslations('chrome');
  return (
    <div
      role="region"
      aria-label="Disclaimer"
      className="border-t border-border bg-muted/50 px-4 py-2 text-center text-xs text-muted-foreground"
    >
      {t('disclaimer')}
    </div>
  );
}
