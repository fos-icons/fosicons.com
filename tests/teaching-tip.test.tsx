import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { TeachingTip } from '../src/components/TeachingTip';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); localStorage.clear(); });

it('shows a nearby tip once and stores its ID locally', async () => {
  let reveal: (() => void) | undefined;
  const observe = vi.fn();
  vi.stubGlobal('IntersectionObserver', class {
    constructor(callback: IntersectionObserverCallback) {
      reveal = () => callback([{ isIntersecting: true } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
    }
    observe = observe;
    disconnect() {}
  });
  const view = render(<TeachingTip tip="modifier" />);
  expect(screen.queryByText(/Pick a modifier/)).toBeNull();
  act(() => reveal?.());
  expect(screen.getByText(/Pick a modifier/)).toBeTruthy();
  expect(localStorage.getItem('fos-learned-tips')).toBe('["modifier"]');
  await userEvent.click(screen.getByRole('button', { name: 'Got it' }));
  expect(screen.queryByText(/Pick a modifier/)).toBeNull();
  view.unmount();
  render(<TeachingTip tip="modifier" />);
  expect(observe).toHaveBeenCalledTimes(1);
});
