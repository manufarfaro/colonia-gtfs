'use client';

import { useTranslations } from 'next-intl';
import { Alert, AlertDescription } from '@/components/ui/alert';

/**
 * Banner persistente con el disclaimer del v0 (PRD §5.2 — "Datos
 * preliminares · operador no oficial · tarifas a confirmar"). Siempre
 * visible, sin botón de cierre (D-10 del design: disclaimers son
 * ciudadanos de primera, no errores que esconder).
 *
 * Override del role a "region": el primitivo Alert de shadcn hardcodea
 * role="alert", lo que anuncia el banner en cada navegación a los
 * screen readers — comportamiento equivocado para un disclaimer
 * permanente. Se trata como landmark estática (region).
 */
export function DisclaimerBanner(): React.ReactElement {
  const t = useTranslations('chrome');
  return (
    <Alert
      role="region"
      aria-label="Disclaimer"
      className="rounded-none border-x-0 border-b-0 border-t bg-muted/50 px-4 py-2"
    >
      <AlertDescription className="justify-items-center text-center text-xs">
        {t('disclaimer')}
      </AlertDescription>
    </Alert>
  );
}
