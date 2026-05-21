import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import esMessages from '@/messages/es.json';
import { LineSelector } from './LineSelector';

function withProvider(ui: React.ReactElement): React.ReactElement {
  return (
    <NextIntlClientProvider locale="es" messages={esMessages}>
      {ui}
    </NextIntlClientProvider>
  );
}

describe('LineSelector', () => {
  it('R-01 renders a chip per line with the design palette color', () => {
    render(withProvider(<LineSelector lines={['3', '4', '5', '8']} onPickLine={() => {}} />));
    expect(screen.getByTestId('line-chip-3')).toBeInTheDocument();
    expect(screen.getByTestId('line-chip-4')).toBeInTheDocument();
    expect(screen.getByTestId('line-chip-5')).toBeInTheDocument();
    expect(screen.getByTestId('line-chip-8')).toBeInTheDocument();
    // Color tokens come from getLineColor() via inline style backgroundColor.
    expect(screen.getByTestId('line-chip-3').getAttribute('style')).toContain('#ef4444');
    expect(screen.getByTestId('line-chip-4').getAttribute('style')).toContain('#3b82f6');
  });

  it('R-01 clicking a chip fires onPickLine with the shortName', () => {
    const onPickLine = vi.fn();
    render(withProvider(<LineSelector lines={['3', '4']} onPickLine={onPickLine} />));
    fireEvent.click(screen.getByTestId('line-chip-4'));
    expect(onPickLine).toHaveBeenCalledWith('4');
  });

  it('R-01 chip has the localised aria-label per line', () => {
    render(withProvider(<LineSelector lines={['3']} onPickLine={() => {}} />));
    expect(screen.getByTestId('line-chip-3')).toHaveAttribute('aria-label', 'Línea 3');
  });

  it('R-01 selector header reads the i18n value', () => {
    render(withProvider(<LineSelector lines={['3']} onPickLine={() => {}} />));
    expect(screen.getByText(/Líneas/)).toBeInTheDocument();
  });
});
