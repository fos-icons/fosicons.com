import { cleanup, createEvent, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useHistoryShortcuts } from '../src/hooks/useHistoryShortcuts';

function setup(platform = 'MacIntel') {
  vi.spyOn(navigator, 'platform', 'get').mockReturnValue(platform);
  const go = vi.spyOn(window.history, 'go').mockImplementation(() => {});
  return { go, ...renderHook(() => useHistoryShortcuts()) };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Browser history shortcuts', () => {
  it('uses Option with either arrow on Mac and removes the listener on unmount', () => {
    const { go, unmount } = setup();

    expect(fireEvent.keyDown(document.body, { key: 'ArrowLeft', altKey: true })).toBe(false);
    expect(fireEvent.keyDown(document.body, { key: 'ArrowRight', altKey: true })).toBe(false);
    expect(go.mock.calls).toEqual([[-1], [1]]);

    unmount();
    expect(fireEvent.keyDown(document.body, { key: 'ArrowLeft', altKey: true })).toBe(true);
    expect(go).toHaveBeenCalledTimes(2);
  });

  it('leaves Windows Alt+Arrow to the browser', () => {
    const { go } = setup('Win32');

    expect(fireEvent.keyDown(document.body, { key: 'ArrowLeft', altKey: true })).toBe(true);
    expect(go).not.toHaveBeenCalled();
  });

  it('does not interfere with editing controls or open dialogs', () => {
    const { go } = setup();
    const { rerender } = render(<>
      <input aria-label="Search" />
      <div contentEditable="plaintext-only"><span>Editable text</span></div>
    </>);

    for (const target of [screen.getByRole('textbox'), screen.getByText('Editable text')]) {
      expect(fireEvent.keyDown(target, { key: 'ArrowLeft', altKey: true })).toBe(true);
    }

    rerender(<dialog open><button>Close dialog</button></dialog>);
    expect(fireEvent.keyDown(screen.getByRole('button'), { key: 'ArrowRight', altKey: true })).toBe(true);
    expect(go).not.toHaveBeenCalled();
  });

  it('leaves plain arrows, other modifiers, repeated presses and handled keys alone', () => {
    const { go } = setup();
    for (const init of [
      { key: 'ArrowLeft' },
      { key: 'ArrowLeft', altKey: true, ctrlKey: true },
      { key: 'ArrowRight', altKey: true, repeat: true },
      { key: 'ArrowRight', altKey: true, isComposing: true },
    ]) {
      expect(fireEvent.keyDown(document.body, init)).toBe(true);
    }
    const handled = createEvent.keyDown(document.body, { key: 'ArrowLeft', altKey: true });
    handled.preventDefault();
    fireEvent(document.body, handled);
    expect(go).not.toHaveBeenCalled();
  });
});
