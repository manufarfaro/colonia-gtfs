import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BottomSheet } from './BottomSheet';

describe('BottomSheet', () => {
  it('R-02 renders nothing when open=false', () => {
    render(
      <BottomSheet open={false} onClose={() => {}}>
        <span>hidden content</span>
      </BottomSheet>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByText('hidden content')).not.toBeInTheDocument();
  });

  it('R-02 renders role=dialog with aria-modal when open=true', () => {
    render(
      <BottomSheet open onClose={() => {}}>
        <span>visible content</span>
      </BottomSheet>,
    );
    const sheet = screen.getByRole('dialog');
    expect(sheet).toBeInTheDocument();
    expect(sheet).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText('visible content')).toBeInTheDocument();
  });

  it('R-02 forwards aria-label when provided', () => {
    render(
      <BottomSheet open onClose={() => {}} ariaLabel="Stop info">
        <span>x</span>
      </BottomSheet>,
    );
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-label', 'Stop info');
  });

  it('R-02 ESC key fires onClose', () => {
    const onClose = vi.fn();
    render(
      <BottomSheet open onClose={onClose}>
        <span>x</span>
      </BottomSheet>,
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('R-02 non-ESC keys do not fire onClose', () => {
    const onClose = vi.fn();
    render(
      <BottomSheet open onClose={onClose}>
        <span>x</span>
      </BottomSheet>,
    );
    fireEvent.keyDown(window, { key: 'Enter' });
    fireEvent.keyDown(window, { key: 'a' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('R-02 ESC fires only when open', () => {
    const onClose = vi.fn();
    render(
      <BottomSheet open={false} onClose={onClose}>
        <span>x</span>
      </BottomSheet>,
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('R-02 click on backdrop fires onClose', () => {
    const onClose = vi.fn();
    render(
      <BottomSheet open onClose={onClose}>
        <span>x</span>
      </BottomSheet>,
    );
    fireEvent.click(screen.getByTestId('bottom-sheet-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('R-02 click inside the sheet does NOT fire onClose', () => {
    const onClose = vi.fn();
    render(
      <BottomSheet open onClose={onClose}>
        <span data-testid="content">x</span>
      </BottomSheet>,
    );
    fireEvent.click(screen.getByTestId('content'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('R-02 swipe down past threshold fires onClose', () => {
    const onClose = vi.fn();
    render(
      <BottomSheet open onClose={onClose}>
        <span>x</span>
      </BottomSheet>,
    );
    const sheet = screen.getByRole('dialog');
    // touchstart at y=200, touchend at y=300 (delta 100, threshold default 80).
    fireEvent.touchStart(sheet, { touches: [{ clientY: 200 }] });
    fireEvent.touchEnd(sheet, { changedTouches: [{ clientY: 300 }] });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('R-02 swipe down below threshold does NOT fire onClose', () => {
    const onClose = vi.fn();
    render(
      <BottomSheet open onClose={onClose}>
        <span>x</span>
      </BottomSheet>,
    );
    const sheet = screen.getByRole('dialog');
    fireEvent.touchStart(sheet, { touches: [{ clientY: 200 }] });
    fireEvent.touchEnd(sheet, { changedTouches: [{ clientY: 240 }] });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('R-02 swipe up (delta negative) does NOT fire onClose', () => {
    const onClose = vi.fn();
    render(
      <BottomSheet open onClose={onClose}>
        <span>x</span>
      </BottomSheet>,
    );
    const sheet = screen.getByRole('dialog');
    fireEvent.touchStart(sheet, { touches: [{ clientY: 300 }] });
    fireEvent.touchEnd(sheet, { changedTouches: [{ clientY: 100 }] });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('R-02 touchEnd without a prior touchStart is a no-op', () => {
    const onClose = vi.fn();
    render(
      <BottomSheet open onClose={onClose}>
        <span>x</span>
      </BottomSheet>,
    );
    const sheet = screen.getByRole('dialog');
    fireEvent.touchEnd(sheet, { changedTouches: [{ clientY: 500 }] });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('R-02 touchEnd uses the last touchStart fallback when changedTouches is empty', () => {
    const onClose = vi.fn();
    render(
      <BottomSheet open onClose={onClose}>
        <span>x</span>
      </BottomSheet>,
    );
    const sheet = screen.getByRole('dialog');
    fireEvent.touchStart(sheet, { touches: [{ clientY: 200 }] });
    fireEvent.touchEnd(sheet, { changedTouches: [] });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('R-02 touchStart with empty touches array nulls the ref', () => {
    const onClose = vi.fn();
    render(
      <BottomSheet open onClose={onClose}>
        <span>x</span>
      </BottomSheet>,
    );
    const sheet = screen.getByRole('dialog');
    fireEvent.touchStart(sheet, { touches: [] });
    fireEvent.touchEnd(sheet, { changedTouches: [{ clientY: 500 }] });
    expect(onClose).not.toHaveBeenCalled();
  });
});
