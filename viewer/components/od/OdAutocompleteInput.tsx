'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import { Button } from '@/components/ui/button';

type Coord = { lat: number; lon: number };
type Bounds = { sw: { lat: number; lng: number }; ne: { lat: number; lng: number } };

export interface OdAutocompleteInputProps {
  id: string;
  label: string;
  placeholder: string;
  bounds: Bounds;
  componentRestrictions: { country: string };
  /** Controlled input value (e.g., "Terminal Buquebus"). The parent
   *  owns the string so it can swap origin↔destination on demand. */
  value: string;
  onValueChange: (next: string) => void;
  onPlaceSelected: (place: Coord | null) => void;
}

/**
 * Single Places-Autocomplete-wired text input. Loads the `places` library
 * via @vis.gl/react-google-maps' `useMapsLibrary`, attaches a Google
 * Autocomplete to the input element, and forwards the picked place's
 * lat/lon (or `null` when the user clears the field) to the parent.
 * The input is CONTROLLED — the parent owns both the typed string and
 * the resolved coordinate, which lets a sibling "swap" button reassign
 * both halves of the OD pair in a single render.
 *
 * The runtime wiring depends on `window.google.maps.places` — there's no
 * meaningful way to exercise that under vitest without a browser. Tests
 * instead mock this whole component (see OriginDestinationInputs.test.tsx)
 * and assert the props are wired correctly. The component itself is
 * excluded from coverage via `vitest.config.ts`.
 */
/* v8 ignore start */
export function OdAutocompleteInput({
  id,
  label,
  placeholder,
  bounds,
  componentRestrictions,
  value,
  onValueChange,
  onPlaceSelected,
}: OdAutocompleteInputProps): React.ReactElement {
  const placesLib = useMapsLibrary('places');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!placesLib || !inputRef.current) return;
    const autocomplete = new placesLib.Autocomplete(inputRef.current, {
      bounds: {
        south: bounds.sw.lat,
        west: bounds.sw.lng,
        north: bounds.ne.lat,
        east: bounds.ne.lng,
      },
      componentRestrictions,
      fields: ['geometry', 'formatted_address', 'name'],
      strictBounds: false,
    });
    const listener = autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();
      const loc = place.geometry?.location;
      // Google writes the picked label into the input directly — sync it
      // back into the controlled value so the parent can swap inputs.
      const label = place.name ?? place.formatted_address ?? inputRef.current?.value ?? '';
      onValueChange(label);
      if (!loc) {
        onPlaceSelected(null);
        return;
      }
      onPlaceSelected({ lat: loc.lat(), lon: loc.lng() });
    });
    return () => {
      listener.remove();
    };
  }, [placesLib, bounds, componentRestrictions, onPlaceSelected, onValueChange]);

  const handleClear = useCallback((): void => {
    onValueChange('');
    onPlaceSelected(null);
  }, [onPlaceSelected, onValueChange]);

  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <input
        ref={inputRef}
        id={id}
        type="text"
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
      />
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        onClick={handleClear}
        aria-label={`clear-${id}`}
        className="text-muted-foreground"
      >
        ×
      </Button>
    </div>
  );
}
/* v8 ignore stop */
