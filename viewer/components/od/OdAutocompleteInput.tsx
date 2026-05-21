'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';

type Coord = { lat: number; lon: number };
type Bounds = { sw: { lat: number; lng: number }; ne: { lat: number; lng: number } };

export interface OdAutocompleteInputProps {
  id: string;
  label: string;
  placeholder: string;
  bounds: Bounds;
  componentRestrictions: { country: string };
  onPlaceSelected: (place: Coord | null) => void;
}

/**
 * Single Places-Autocomplete-wired text input. Loads the `places` library
 * via @vis.gl/react-google-maps' `useMapsLibrary`, attaches a Google
 * Autocomplete to the input element, and forwards the picked place's
 * lat/lon (or `null` when the user clears the field) to the parent.
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
  onPlaceSelected,
}: OdAutocompleteInputProps): React.ReactElement {
  const placesLib = useMapsLibrary('places');
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState('');

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
      fields: ['geometry'],
      strictBounds: false,
    });
    const listener = autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();
      const loc = place.geometry?.location;
      if (!loc) {
        onPlaceSelected(null);
        return;
      }
      onPlaceSelected({ lat: loc.lat(), lon: loc.lng() });
    });
    return () => {
      listener.remove();
    };
  }, [placesLib, bounds, componentRestrictions, onPlaceSelected]);

  const handleClear = useCallback((): void => {
    setValue('');
    onPlaceSelected(null);
  }, [onPlaceSelected]);

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
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
      />
      <button
        type="button"
        onClick={handleClear}
        aria-label={`clear-${id}`}
        className="rounded-md border border-border px-2 py-2 text-muted-foreground"
      >
        ×
      </button>
    </div>
  );
}
/* v8 ignore stop */
