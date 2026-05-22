import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import esMessages from '@/messages/es.json';
import type { PlanInput } from './usePlanQuery';

type MountedInput = {
  id: string;
  bounds: unknown;
  componentRestrictions: unknown;
  value: string;
  onValueChange: (next: string) => void;
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
    value: string;
    onValueChange: (next: string) => void;
    onPlaceSelected: (place: PlanInput['from'] | null) => void;
  }): React.ReactElement {
    const idx = mounted.findIndex((m) => m.id === props.id);
    const snapshot = {
      id: props.id,
      bounds: props.bounds,
      componentRestrictions: props.componentRestrictions,
      value: props.value,
      onValueChange: props.onValueChange,
      onPlaceSelected: props.onPlaceSelected,
    };
    if (idx >= 0) mounted[idx] = snapshot;
    else mounted.push(snapshot);
    return (
      <div data-testid={`stub-${props.id}`} data-bounds-sw-lat={(props.bounds as { sw: { lat: number } }).sw.lat} data-value={props.value}>
        <label htmlFor={props.id}>{props.label}</label>
        <input id={props.id} placeholder={props.placeholder} value={props.value} onChange={(e) => props.onValueChange(e.target.value)} />
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

  it('R-03 swap button is disabled until at least one input has text', () => {
    renderInputs(() => {});
    const swap = screen.getByTestId('od-swap');
    expect(swap.hasAttribute('disabled')).toBe(true);
    fireEvent.change(screen.getByLabelText('Origen'), { target: { value: 'Buquebus' } });
    expect(swap.hasAttribute('disabled')).toBe(false);
  });

  it('R-03 swap exchanges typed text + resolved coords between origin and destination', () => {
    const onChange = vi.fn();
    renderInputs(onChange);
    fireEvent.change(screen.getByLabelText('Origen'), { target: { value: 'Buquebus' } });
    fireEvent.change(screen.getByLabelText('Destino'), { target: { value: 'Plaza de Toros' } });
    mounted.find((m) => m.id === 'origin')!.onPlaceSelected({ lat: -34.471, lon: -57.852 });
    mounted.find((m) => m.id === 'destination')!.onPlaceSelected({ lat: -34.437, lon: -57.865 });
    fireEvent.click(screen.getByTestId('od-swap'));
    expect(onChange).toHaveBeenLastCalledWith({
      from: { lat: -34.437, lon: -57.865 },
      to: { lat: -34.471, lon: -57.852 },
    });
    expect((screen.getByLabelText('Origen') as HTMLInputElement).value).toBe('Plaza de Toros');
    expect((screen.getByLabelText('Destino') as HTMLInputElement).value).toBe('Buquebus');
  });
});
