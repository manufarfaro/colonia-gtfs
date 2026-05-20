import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ThemeProvider } from './ThemeProvider';

describe('ThemeProvider', () => {
  it('R-13 renders its children inside next-themes', () => {
    render(
      <ThemeProvider>
        <span data-testid="child">hello</span>
      </ThemeProvider>,
    );
    expect(screen.getByTestId('child')).toHaveTextContent('hello');
  });

  it('R-13 forwards extra props to next-themes (forceTheme override)', () => {
    // forceTheme is a next-themes prop — it should reach the underlying
    // provider via the {...props} spread. We assert by reading the
    // `data-theme` attribute next-themes writes onto <html>.
    render(
      <ThemeProvider forcedTheme="dark">
        <span data-testid="child">x</span>
      </ThemeProvider>,
    );
    expect(document.documentElement.getAttribute('class')).toContain('dark');
  });
});
