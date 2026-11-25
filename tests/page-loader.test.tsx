import { cleanup, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { PageLoader } from '../src/components/PageLoader';
import { SlashHint } from '../src/components/ui';

afterEach(cleanup);

describe('Page loader', () => {
  it('announces loading and shows the Fos mark', () => {
    render(<PageLoader />);
    const status = screen.getByRole('status');
    expect(status.textContent?.trim()).toBe('Loading page…');
    expect(status.querySelector('.page-loader-mark svg')).not.toBeNull();
  });

  it('bounces only without reduced motion and stays out of the page cascade', () => {
    const css = readFileSync(join(__dirname, '../src/styles/index.css'), 'utf8');
    const motion = css.slice(css.indexOf('prefers-reduced-motion: no-preference'));
    expect(motion).toContain('.page-loader-mark { animation: loader-bounce');
    expect(css).toContain('.route-enter > :not(.page-loader) > *');
  });
});

describe('Slash hint', () => {
  it('is a square key in both sizes', () => {
    const { container } = render(<><SlashHint /><SlashHint size="md" /></>);
    const [small, medium] = container.querySelectorAll('kbd');
    expect(small.className).toContain('size-5');
    expect(medium.className).toContain('size-6');
    expect(small.getAttribute('aria-hidden')).toBe('true');
  });
});
