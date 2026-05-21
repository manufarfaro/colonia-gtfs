'use client';

import { useCallback, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { COLONIA_BBOX, PLACES_COMPONENT_RESTRICTIONS } from '@/lib/google-maps/places-options';
import { OdAutocompleteInput } from './OdAutocompleteInput';
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
  // Track the latest pair in refs so each callback reads the up-to-date
  // counterpart without re-rendering. The inputs themselves keep their
  // own visual state (typed text) inside `OdAutocompleteInput`.
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

  return (
    <div className="flex flex-col gap-2">
      <OdAutocompleteInput
        id="origin"
        label={t('origin.label')}
        placeholder={t('origin.placeholder')}
        bounds={COLONIA_BBOX}
        componentRestrictions={PLACES_COMPONENT_RESTRICTIONS}
        onPlaceSelected={handleOrigin}
      />
      <OdAutocompleteInput
        id="destination"
        label={t('destination.label')}
        placeholder={t('destination.placeholder')}
        bounds={COLONIA_BBOX}
        componentRestrictions={PLACES_COMPONENT_RESTRICTIONS}
        onPlaceSelected={handleDestination}
      />
    </div>
  );
}
