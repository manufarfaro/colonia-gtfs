import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import esMessages from '@/messages/es.json';
import type { PlanInput } from './usePlanQuery';

// Capture every <OdAutocompleteInput> mounted so the test can drive the
// synthetic `place_changed` callback and verify the wired props.
type MountedInput = {
  id: string;
  bounds: unknown;
  componentRestrictions: unknown;
  onPlaceSelected: (place: PlanInput['from'] | null) => void;
};
const mounted: MountedInput[] = [];

vi.mock('./OdAutocompleteInput', () => ({
  OdAutocompleteInput(props: {
    id: string;
    label: string;
    placeholder: string;
    bounds: unknown;
    componentRestrictions: unknown;
    onPlaceSelected: (place: PlanInput['from'] | null) => void;
  }): React.ReactElement {
    mounted.push({
      id: props.id,
      bounds: props.bounds,
      componentRestrictions: props.componentRestrictions,
      onPlaceSelected: props.onPlaceSelected,
    });
    return (
      <div data-testid={`stub-${props.id}`} data-bounds-sw-lat={(props.bounds as { sw: { lat: number } }).sw.lat}>
        <label htmlFor={props.id}>{props.label}</label>
        <input id={props.id} placeholder={props.placeholder} />
        <button onClick={() => props.onPlaceSelected(null)} aria-label={`clear-${props.id}`}>
          ×
        </button>
      </div>
    );
  },
}));

import { OriginDestinationInputs } from './OriginDestinationInputs';

function renderInputs(onChange: (state: { from: PlanInput['from'] | null; to: PlanInput['to'] | null }) => void): void {
  render(
    <NextIntlClientProvider locale="es" messages={esMessages}>
      <OriginDestinationInputs onChange={onChange} />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  mounted.length = 0;
});

describe('OriginDestinationInputs', () => {
  it('R-03 mounts both inputs with the Colonia bbox + UY-only restrictions', () => {
    renderInputs(() => {});
    expect(mounted).toHaveLength(2);
    expect(mounted.map((m) => m.id)).toEqual(['origin', 'destination']);
    for (const m of mounted) {
      expect(m.bounds).toEqual({
        sw: { lat: -34.49, lng: -57.87 },
        ne: { lat: -34.435, lng: -57.8 },
      });
      expect(m.componentRestrictions).toEqual({ country: 'uy' });
    }
  });

  it('R-03 calls onChange with the picked origin coords (destination still null)', () => {
    const onChange = vi.fn();
    renderInputs(onChange);
    mounted[0].onPlaceSelected({ lat: -34.471, lon: -57.852 });
    expect(onChange).toHaveBeenLastCalledWith({
      from: { lat: -34.471, lon: -57.852 },
      to: null,
    });
  });

  it('R-03 calls onChange with both endpoints once both inputs resolved', () => {
    const onChange = vi.fn();
    renderInputs(onChange);
    mounted[0].onPlaceSelected({ lat: -34.471, lon: -57.852 });
    mounted[1].onPlaceSelected({ lat: -34.449, lon: -57.815 });
    expect(onChange).toHaveBeenLastCalledWith({
      from: { lat: -34.471, lon: -57.852 },
      to: { lat: -34.449, lon: -57.815 },
    });
  });

  it('R-03 calls onChange with null on the cleared input', () => {
    const onChange = vi.fn();
    renderInputs(onChange);
    mounted[0].onPlaceSelected({ lat: -34.471, lon: -57.852 });
    mounted[0].onPlaceSelected(null);
    expect(onChange).toHaveBeenLastCalledWith({ from: null, to: null });
  });

  it('R-03 surfaces the i18n labels + placeholders', () => {
    renderInputs(() => {});
    expect(screen.getByLabelText('Origen')).toBeInTheDocument();
    expect(screen.getByLabelText('Destino')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Terminal Buquebus Colonia/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Plaza de Toros Real de San Carlos/)).toBeInTheDocument();
  });

  it('R-03 clicking the clear button fires null through the wired callback', () => {
    const onChange = vi.fn();
    renderInputs(onChange);
    fireEvent.click(screen.getByLabelText('clear-origin'));
    expect(onChange).toHaveBeenLastCalledWith({ from: null, to: null });
  });
});
