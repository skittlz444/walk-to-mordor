import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, waitFor, within } from '@testing-library/preact';
import { EncounterPopupIsland } from './EncounterPopupIsland';
import type { EncounterDefinition, EncounterOffer } from '../types/encounter';

const mockFetch = vi.fn();

const baseDefinition: EncounterDefinition = {
  id: 7,
  slug: 'nazgul-pursuit',
  name: 'The Nazgûl Pursuit',
  description: 'Riders hunt you across the moonlit moor.',
  image_slug: 'nazgul-pursuit',
  badge_slug: 'challenge-nazgul-outrun',
  duration_days: 3,
};

function makeOffer(overrides: Partial<EncounterOffer> = {}): EncounterOffer {
  return {
    status: 'offered',
    definition: { ...baseDefinition },
    target: 18.5,
    coverageStart: '2026-11-05',
    coverageEnd: '2026-11-07',
    graceDeadline: '2026-11-10',
    ...overrides,
  };
}

function okResponse() {
  return { ok: true, status: 200, json: () => Promise.resolve({}) };
}

function failResponse(status = 500) {
  return { ok: false, status };
}

function lastRequest(): { url: string; init: RequestInit } {
  const [url, init] = mockFetch.mock.calls[mockFetch.mock.calls.length - 1] as [string, RequestInit];
  return { url, init };
}

/** Let the accept/decline handler finish its awaits under fake timers. */
async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe('EncounterPopupIsland', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('renders the offer copy, artwork, target, coverage window, and grace footnote', () => {
    const { getByRole, getByText, container } = render(
      <EncounterPopupIsland offer={makeOffer()} onClose={vi.fn()} />,
    );

    const dialog = getByRole('dialog', { name: 'The Nazgûl Pursuit' });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(getByText('Riders hunt you across the moonlit moor.')).toBeTruthy();
    expect(getByText('Your target: 18.5 km')).toBeTruthy();
    expect(getByText(/Today through/)).toBeTruthy();
    expect(getByText('2026-11-07')).toBeTruthy();
    expect(getByText(/to log walks for these days/)).toBeTruthy();
    expect(getByText('2026-11-10')).toBeTruthy();
    expect(container.querySelector('img')?.getAttribute('src'))
      .toBe('/img/highres/nazgul-pursuit.webp');
    expect(within(dialog).getByRole('button', { name: 'Accept' })).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: 'Decline' })).toBeTruthy();
  });

  it('accepts with the definition id, confirms briefly, then closes', async () => {
    vi.useFakeTimers();
    mockFetch.mockResolvedValue(okResponse());
    const onClose = vi.fn();

    const { getByRole, queryByRole } = render(
      <EncounterPopupIsland offer={makeOffer()} onClose={onClose} />,
    );

    fireEvent.click(getByRole('button', { name: 'Accept' }));
    await act(async () => { await flushPromises(); });

    const { url, init } = lastRequest();
    expect(url).toBe('/api/events/daily-roll/accept');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ encounter_definition_id: 7 });

    expect(getByRole('status').textContent).toContain('The hunt is on. Outrun the Nazgûl.');
    expect(onClose).not.toHaveBeenCalled();

    act(() => { vi.advanceTimersByTime(4000); });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(queryByRole('alert')).toBeNull();
  });

  it('disables both actions while the accept request is in flight', async () => {
    let resolveFetch!: (value: unknown) => void;
    mockFetch.mockReturnValue(new Promise((resolve) => { resolveFetch = resolve; }));
    const onClose = vi.fn();

    const { getByRole } = render(
      <EncounterPopupIsland offer={makeOffer()} onClose={onClose} />,
    );

    const accept = getByRole('button', { name: 'Accept' }) as HTMLButtonElement;
    const decline = getByRole('button', { name: 'Decline' }) as HTMLButtonElement;

    fireEvent.click(accept);

    await waitFor(() => expect(accept.disabled).toBe(true));
    expect(decline.disabled).toBe(true);

    resolveFetch(okResponse());
    await waitFor(() => expect(getByRole('status')).toBeTruthy());
    expect(onClose).not.toHaveBeenCalled();
  });

  it('declines with the definition id and closes immediately', async () => {
    mockFetch.mockResolvedValue(okResponse());
    const onClose = vi.fn();

    const { getByRole, queryByRole } = render(
      <EncounterPopupIsland offer={makeOffer()} onClose={onClose} />,
    );

    fireEvent.click(getByRole('button', { name: 'Decline' }));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));

    const { url, init } = lastRequest();
    expect(url).toBe('/api/events/daily-roll/decline');
    expect(JSON.parse(init.body as string)).toEqual({ encounter_definition_id: 7 });
    expect(queryByRole('status')).toBeNull();
  });

  it('shows an alert and stays open when accepting fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mockFetch.mockResolvedValue(failResponse(500));
    const onClose = vi.fn();

    const { getByRole, findByRole } = render(
      <EncounterPopupIsland offer={makeOffer()} onClose={onClose} />,
    );

    fireEvent.click(getByRole('button', { name: 'Accept' }));

    expect((await findByRole('alert')).textContent).toContain('could not start');
    expect(getByRole('dialog')).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();

    await waitFor(() => {
      expect((getByRole('button', { name: 'Accept' }) as HTMLButtonElement).disabled).toBe(false);
    });
  });

  it('shows an alert and stays open when declining fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mockFetch.mockResolvedValue(failResponse(500));
    const onClose = vi.fn();

    const { getByRole, findByRole } = render(
      <EncounterPopupIsland offer={makeOffer()} onClose={onClose} />,
    );

    fireEvent.click(getByRole('button', { name: 'Decline' }));

    expect((await findByRole('alert')).textContent).toContain('could not decline');
    expect(getByRole('dialog')).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('renders nothing for a malformed or missing offer', () => {
    const malformed = { ...makeOffer(), target: 'lots' } as unknown as EncounterOffer;
    const missing = { status: 'offered' } as unknown as EncounterOffer;

    const first = render(<EncounterPopupIsland offer={malformed} onClose={vi.fn()} />);
    expect(first.container.innerHTML).toBe('');

    const second = render(
      <EncounterPopupIsland offer={missing} onClose={vi.fn()} />,
    );
    expect(second.container.innerHTML).toBe('');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('hides the artwork after an image error without losing the copy', async () => {
    const { container, getByText } = render(
      <EncounterPopupIsland offer={makeOffer()} onClose={vi.fn()} />,
    );

    const image = container.querySelector('img') as HTMLImageElement;
    fireEvent.error(image);

    await waitFor(() => expect(container.querySelector('img')).toBeNull());
    expect(getByText('The Nazgûl Pursuit')).toBeTruthy();
    expect(getByText('Your target: 18.5 km')).toBeTruthy();
  });

  it('omits the artwork for a null or unsafe image slug', () => {
    const withoutImage = render(
      <EncounterPopupIsland
        offer={makeOffer({ definition: { ...baseDefinition, image_slug: null } })}
        onClose={vi.fn()}
      />,
    );
    expect(withoutImage.container.querySelector('img')).toBeNull();
    expect(withoutImage.getByText('The Nazgûl Pursuit')).toBeTruthy();

    withoutImage.unmount();

    const unsafeImage = render(
      <EncounterPopupIsland
        offer={makeOffer({ definition: { ...baseDefinition, image_slug: '../secrets' } })}
        onClose={vi.fn()}
      />,
    );
    expect(unsafeImage.container.querySelector('img')).toBeNull();
    expect(unsafeImage.getByText('Your target: 18.5 km')).toBeTruthy();
  });

  it('moves focus into the dialog, traps Tab, and declines on Escape', async () => {
    mockFetch.mockResolvedValue(okResponse());
    const onClose = vi.fn();

    const trigger = document.createElement('button');
    trigger.textContent = 'Log walk';
    document.body.appendChild(trigger);
    trigger.focus();

    try {
      const { getByRole, unmount } = render(
        <EncounterPopupIsland offer={makeOffer()} onClose={onClose} />,
      );

      const dialog = getByRole('dialog');
      const accept = getByRole('button', { name: 'Accept' });
      const decline = getByRole('button', { name: 'Decline' });

      expect(dialog.getAttribute('aria-modal')).toBe('true');
      expect(dialog.getAttribute('aria-labelledby')).toBe(dialog.querySelector('h2')?.id);

      await waitFor(() => expect(document.activeElement).toBe(accept));

      decline.focus();
      fireEvent.keyDown(document, { key: 'Tab' });
      expect(document.activeElement).toBe(accept);

      fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
      expect(document.activeElement).toBe(decline);

      fireEvent.keyDown(document, { key: 'Escape' });
      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
      expect(lastRequest().url).toBe('/api/events/daily-roll/decline');

      unmount();
      await waitFor(() => expect(document.activeElement).toBe(trigger));
    } finally {
      trigger.remove();
    }
  });
});
