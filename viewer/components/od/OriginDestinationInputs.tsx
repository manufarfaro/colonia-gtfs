'use client';

import { useCallback, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { COLONIA_BBOX, PLACES_COMPONENT_RESTRICTIONS } from '@/lib/google-maps/places-options';
import { OdAutocompleteInput } from './OdAutocompleteInput';
import { Button } from '@/components/ui/button';
import type { PlanInput } from './usePlanQuery';

type Coord = { lat: number; lon: number };

export interface OdInputsChange {
  from: Coord | null;
  to: Coord | null;
}

export function OriginDestinationInputs({
  onChange,
}: {
  onChange: (change: OdInputsChange) => void;
}): React.ReactElement {
  const t = useTranslations('od.search');

  const [originText, setOriginText] = useState('');
  const [destinationText, setDestinationText] = useState('');
  // Coords kept in refs so we can read them inside the swap handler
  // without a stale closure.
  const fromRef = useRef<Coord | null>(null);
  const toRef = useRef<Coord | null>(null);

  const handleOrigin = useCallback(
    (place: PlanInput['from'] | null) => {
      fromRef.current = place;
      onChange({ from: place, to: toRef.current });
    },
    [onChange],
  );
  const handleDestination = useCallback(
    (place: PlanInput['to'] | null) => {
      toRef.current = place;
      onChange({ from: fromRef.current, to: place });
    },
    [onChange],
  );

  const handleSwap = useCallback(() => {
    const prevOriginText = originText;
    const prevDestinationText = destinationText;
    const prevFrom = fromRef.current;
    const prevTo = toRef.current;
    setOriginText(prevDestinationText);
    setDestinationText(prevOriginText);
    fromRef.current = prevTo;
    toRef.current = prevFrom;
    onChange({ from: prevTo, to: prevFrom });
  }, [originText, destinationText, onChange]);

  const canSwap = originText.trim() !== '' || destinationText.trim() !== '';

  return (
    <div className="flex flex-col gap-2">
      <OdAutocompleteInput
        id="origin"
        label={t('origin.label')}
        placeholder={t('origin.placeholder')}
        bounds={COLONIA_BBOX}
        componentRestrictions={PLACES_COMPONENT_RESTRICTIONS}
        value={originText}
        onValueChange={setOriginText}
        onPlaceSelected={handleOrigin}
      />
      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          size="icon-xs"
          data-testid="od-swap"
          aria-label={t('swap')}
          title={t('swap')}
          onClick={handleSwap}
          disabled={!canSwap}
          className="-my-1 rounded-full text-muted-foreground"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m17 3 4 4-4 4" />
            <path d="M21 7H9" />
            <path d="m7 21-4-4 4-4" />
            <path d="M3 17h12" />
          </svg>
        </Button>
      </div>
      <OdAutocompleteInput
        id="destination"
        label={t('destination.label')}
        placeholder={t('destination.placeholder')}
        bounds={COLONIA_BBOX}
        componentRestrictions={PLACES_COMPONENT_RESTRICTIONS}
        value={destinationText}
        onValueChange={setDestinationText}
        onPlaceSelected={handleDestination}
      />
    </div>
  );
}
