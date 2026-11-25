import { cleanup, render, screen } from '@testing-library/react';
import { Suspense, type ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PageBoundary } from '../src/components/PageBoundary';
import { isChunkLoadError, lazyPage, reloadForNewVersion } from '../src/lib/lazy-page';

const chunkError = () => new TypeError('Failed to fetch dynamically imported module: https://www.fosicons.com/assets/IconPage-abc123.js');
let reload: ReturnType<typeof vi.fn>;

beforeEach(() => {
  sessionStorage.clear();
  reload = vi.fn();
  vi.stubGlobal('location', { ...window.location, reload });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('lazy page loading', () => {
  it('recognizes chunk load failures from each browser', () => {
    expect(isChunkLoadError(chunkError())).toBe(true);
    expect(isChunkLoadError(new TypeError('Importing a module script failed.'))).toBe(true);
    expect(isChunkLoadError(new TypeError('error loading dynamically imported module: /assets/x.js'))).toBe(true);
    expect(isChunkLoadError(new Error('Unable to preload CSS for /assets/index.css'))).toBe(true);
    expect(isChunkLoadError(new TypeError("Cannot read properties of undefined (reading 'name')"))).toBe(false);
    expect(isChunkLoadError('nope')).toBe(false);
  });

  it('reloads once, then stops so a broken build cannot loop', () => {
    expect(reloadForNewVersion(1_000_000)).toBe(true);
    expect(reloadForNewVersion(1_010_000)).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(reloadForNewVersion(1_100_000)).toBe(true);
    expect(reload).toHaveBeenCalledTimes(2);
  });

  const renderLazy = (load: () => Promise<{ default: () => ReactElement }>) => {
    const Page = lazyPage(load);
    return render(
      <MemoryRouter>
        <PageBoundary><Suspense fallback={<p>Loading page…</p>}><Page /></Suspense></PageBoundary>
      </MemoryRouter>,
    );
  };

  it('reloads instead of showing an error when a page chunk is missing', async () => {
    renderLazy(() => Promise.reject(chunkError()));
    await vi.waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByText('Loading page…')).toBeTruthy();
  });

  it('explains a download failure when reloading already failed', async () => {
    sessionStorage.setItem('fos:chunk-reload', String(Date.now()));
    renderLazy(() => Promise.reject(chunkError()));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/couldn’t be downloaded/);
    expect(reload).not.toHaveBeenCalled();
  });

  it('shows the general message and logs other errors', async () => {
    const Broken = () => { throw new Error('render bug'); };
    renderLazy(() => Promise.resolve({ default: Broken }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/Something went wrong/);
    expect(reload).not.toHaveBeenCalled();
    expect(vi.mocked(console.error).mock.calls.some(([tag]) => tag === '[PageBoundary]')).toBe(true);
  });
});
