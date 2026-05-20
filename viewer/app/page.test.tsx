import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// next-intl/server reads from a request-scoped context that vitest doesn't
// run inside. Mock the translator factory to return a stub `t(key)` that
// echoes its argument — the assertion below verifies the keys hit.
vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn().mockImplementation(async (ns: string) => (key: string) => `${ns}.${key}`),
}));

import HomePage from './page';

describe('app/page.tsx', () => {
  it('R-01 renders the landing title and subtitle from the i18n catalog', async () => {
    const element = await HomePage();
    const { container } = render(element);
    expect(container.textContent).toContain('landing.title');
    expect(container.textContent).toContain('landing.subtitle');
    expect(container.querySelector('h1')).not.toBeNull();
  });
});
