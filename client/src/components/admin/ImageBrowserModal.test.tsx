import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/preact';
import { ImageBrowserModal } from './ImageBrowserModal';

const mockFetch = vi.fn();

const mockManifest = { images: ['bag-end', 'rivendell', 'weathertop'] };

const mockGoalsResponse = {
  goals: [
    { id: 1, title: 'Bag End', image_id: 'bag-end' },
    { id: 2, title: 'Rivendell', image_id: null },
  ],
  total: 2,
  page: 1,
  pageSize: 100,
  totalPages: 1,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', mockFetch);
  vi.stubGlobal('localStorage', {
    getItem: vi.fn((key: string) => (key === 'sessionToken' ? 'admin-token' : null)),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  });

  mockFetch.mockImplementation((url: string) => {
    if (url.includes('image-manifest.json')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockManifest),
      });
    }
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve(mockGoalsResponse),
    });
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('ImageBrowserModal', () => {
  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <ImageBrowserModal
        isOpen={false}
        onClose={vi.fn()}
        onSelect={vi.fn()}
        currentImageId=""
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders the dialog when isOpen is true', () => {
    const { container } = render(
      <ImageBrowserModal
        isOpen={true}
        onClose={vi.fn()}
        onSelect={vi.fn()}
        currentImageId=""
      />,
    );

    expect(container.querySelector('[role="dialog"]')).toBeTruthy();
    expect(container.querySelector('.admin-image-browser')).toBeTruthy();
  });

  it('shows loading state while fetching', () => {
    mockFetch.mockReturnValue(new Promise(() => {}));

    const { container } = render(
      <ImageBrowserModal
        isOpen={true}
        onClose={vi.fn()}
        onSelect={vi.fn()}
        currentImageId=""
      />,
    );

    expect(container.querySelector('.admin-loading')).toBeTruthy();
  });

  it('displays image tiles after successful fetch', async () => {
    const { getByText } = render(
      <ImageBrowserModal
        isOpen={true}
        onClose={vi.fn()}
        onSelect={vi.fn()}
        currentImageId=""
      />,
    );

    await waitFor(() => {
      expect(getByText('bag-end')).toBeTruthy();
    });

    expect(getByText('rivendell')).toBeTruthy();
    expect(getByText('weathertop')).toBeTruthy();
  });

  it('shows "In use" badge for images assigned to other goals', async () => {
    const { container } = render(
      <ImageBrowserModal
        isOpen={true}
        onClose={vi.fn()}
        onSelect={vi.fn()}
        currentImageId=""
      />,
    );

    await waitFor(() => {
      const badges = container.querySelectorAll('.admin-image-tile__badge');
      const inUseBadge = Array.from(badges).find((b) => b.textContent === 'In use');
      expect(inUseBadge).toBeTruthy();
    });
  });

  it('shows "Current" badge for the currently selected image', async () => {
    const { container } = render(
      <ImageBrowserModal
        isOpen={true}
        onClose={vi.fn()}
        onSelect={vi.fn()}
        currentImageId="rivendell"
      />,
    );

    await waitFor(() => {
      const currentBadge = container.querySelector('.admin-image-tile__badge--current') as HTMLElement;
      expect(currentBadge).toBeTruthy();
      expect(currentBadge.textContent).toBe('Current');
    });
  });

  it('filters images based on search input', async () => {
    const { container, getByText, queryByText } = render(
      <ImageBrowserModal
        isOpen={true}
        onClose={vi.fn()}
        onSelect={vi.fn()}
        currentImageId=""
      />,
    );

    await waitFor(() => {
      expect(getByText('bag-end')).toBeTruthy();
    });

    const searchInput = container.querySelector('.admin-image-browser__search-input') as HTMLInputElement;
    searchInput.value = 'rive';
    searchInput.dispatchEvent(new Event('input', { bubbles: true }));

    await waitFor(() => {
      expect(getByText('rivendell')).toBeTruthy();
      expect(queryByText('bag-end')).toBeNull();
      expect(queryByText('weathertop')).toBeNull();
    });
  });

  it('calls onSelect and onClose when an image tile is clicked', async () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();

    const { getByText } = render(
      <ImageBrowserModal
        isOpen={true}
        onClose={onClose}
        onSelect={onSelect}
        currentImageId=""
      />,
    );

    await waitFor(() => {
      expect(getByText('rivendell')).toBeTruthy();
    });

    const tile = getByText('rivendell').closest('button') as HTMLElement;
    tile.click();

    expect(onSelect).toHaveBeenCalledWith('rivendell');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when the close button is clicked', async () => {
    const onClose = vi.fn();

    const { container } = render(
      <ImageBrowserModal
        isOpen={true}
        onClose={onClose}
        onSelect={vi.fn()}
        currentImageId=""
      />,
    );

    await waitFor(() => {
      expect(container.querySelector('.admin-image-browser__close')).toBeTruthy();
    });

    (container.querySelector('.admin-image-browser__close') as HTMLElement).click();

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when ESC key is pressed', () => {
    const onClose = vi.fn();

    render(
      <ImageBrowserModal
        isOpen={true}
        onClose={onClose}
        onSelect={vi.fn()}
        currentImageId=""
      />,
    );

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows error alert when manifest fetch fails', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('image-manifest.json')) {
        return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockGoalsResponse),
      });
    });

    const { getByRole } = render(
      <ImageBrowserModal
        isOpen={true}
        onClose={vi.fn()}
        onSelect={vi.fn()}
        currentImageId=""
      />,
    );

    await waitFor(() => {
      expect(getByRole('alert')).toBeTruthy();
    });
  });

  it('filters images case-insensitively (mixed-case input matches lowercase slugs)', async () => {
    const mixedCaseManifest = { images: ['Bag-End', 'RIVENDELL', 'WeatherTop'] };
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('image-manifest.json')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mixedCaseManifest),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockGoalsResponse),
      });
    });

    const { container, getByText, queryByText } = render(
      <ImageBrowserModal
        isOpen={true}
        onClose={vi.fn()}
        onSelect={vi.fn()}
        currentImageId=""
      />,
    );

    await waitFor(() => {
      expect(getByText('Bag-End')).toBeTruthy();
    });

    // Type uppercase filter — should still match lowercase slugs
    const searchInput = container.querySelector('.admin-image-browser__search-input') as HTMLInputElement;
    searchInput.value = 'RIVEN';
    searchInput.dispatchEvent(new Event('input', { bubbles: true }));

    await waitFor(() => {
      expect(getByText('RIVENDELL')).toBeTruthy();
      expect(queryByText('Bag-End')).toBeNull();
      expect(queryByText('WeatherTop')).toBeNull();
    });
  });

  it('shows count of filtered images vs total images', async () => {
    const { container } = render(
      <ImageBrowserModal
        isOpen={true}
        onClose={vi.fn()}
        onSelect={vi.fn()}
        currentImageId=""
      />,
    );

    await waitFor(() => {
      const count = container.querySelector('.admin-image-browser__count') as HTMLElement;
      expect(count.textContent).toContain('3 of 3');
    });
  });
});
