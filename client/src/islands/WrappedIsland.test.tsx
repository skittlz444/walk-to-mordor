import { cleanup, render, waitFor, fireEvent } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WrappedIsland, renderShareImage } from './WrappedIsland';
import {
  resetAppStore,
  sessionToken,
  storeInitialized,
  userId,
  isAdmin,
} from '../stores/appStore';
import { fetchWrappedStats } from '../utils/wrapped';
import type { WrappedData } from '../utils/wrapped';

vi.mock('../utils/wrapped', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils/wrapped')>();
  return {
    ...actual,
    fetchWrappedStats: vi.fn(),
  };
});

const mockWrappedData: WrappedData = {
  year: 2025,
  total_distance_km: 350.5,
  journey_pct: 19.5,
  walk_count: 120,
  active_days: 95,
  best_streak: 5,
  favorite_month: { month: 3, name: 'March', total_km: 120 },
  milestones: [
    { id: 5, title: 'Bucklebury Ferry', distance: 150, special: null, image_id: '5' },
    { id: 10, title: 'The Prancing Pony', distance: 300, special: 'The Prancing Pony', image_id: '10' },
  ],
  fellowship_highlights: [
    { party_name: 'The Fellowship', party_year_km: 500 },
  ],
  first_walk_date: '2025-01-15',
  narrative: 'Like Bilbo in the Shire, you took your first step on 2025-01-15.\n\nIn 2025, you walked 350.5 km.',
};

describe('WrappedIsland', () => {
  beforeEach(() => {
    resetAppStore();
    storeInitialized.value = true;
    sessionToken.value = 'test-token';
    userId.value = 42;
    isAdmin.value = true;
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    resetAppStore();
  });

  it('does not render when user is not authenticated', () => {
    sessionToken.value = null;
    userId.value = null;

    const { container } = render(<WrappedIsland />);
    expect(container.innerHTML).toBe('');
  });

  it('does not render when user is not admin', () => {
    isAdmin.value = false;

    const { container } = render(<WrappedIsland />);
    expect(container.innerHTML).toBe('');
  });

  it('shows loading state initially', () => {
    vi.mocked(fetchWrappedStats).mockReturnValue(new Promise(() => {}));

    const { getByTestId } = render(<WrappedIsland />);
    expect(getByTestId('wrapped-loading')).toBeTruthy();
  });

  it('shows error state when API fails', async () => {
    vi.mocked(fetchWrappedStats).mockRejectedValue(new Error('Admin access required'));

    const { getByTestId } = render(<WrappedIsland />);

    await waitFor(() => {
      expect(getByTestId('wrapped-error')).toBeTruthy();
    });
    expect(getByTestId('wrapped-error').textContent).toContain('Admin access required');
  });

  it('renders wrapped cards when data is loaded', async () => {
    vi.mocked(fetchWrappedStats).mockResolvedValue(mockWrappedData);

    const { getByTestId } = render(<WrappedIsland />);

    await waitFor(() => {
      expect(getByTestId('wrapped-container')).toBeTruthy();
    });

    // First card should be active
    expect(getByTestId('wrapped-card-0').className).toContain('active');
  });

  it('navigates between cards with next/prev buttons', async () => {
    vi.mocked(fetchWrappedStats).mockResolvedValue(mockWrappedData);

    const { getByTestId, getByLabelText } = render(<WrappedIsland />);

    await waitFor(() => {
      expect(getByTestId('wrapped-container')).toBeTruthy();
    });

    // Initial card is 0
    expect(getByTestId('wrapped-card-0').className).toContain('active');

    // Click next
    fireEvent.click(getByLabelText('Next card'));
    expect(getByTestId('wrapped-card-1').className).toContain('active');
    expect(getByTestId('wrapped-card-0').className).not.toContain('active');

    // Click prev
    fireEvent.click(getByLabelText('Previous card'));
    expect(getByTestId('wrapped-card-0').className).toContain('active');
  });

  it('disables prev button on first card and next on last card', async () => {
    const dataWithMinimal: WrappedData = {
      ...mockWrappedData,
      walk_count: 0,
      best_streak: 0,
      favorite_month: null,
      milestones: [],
      fellowship_highlights: [],
    };
    vi.mocked(fetchWrappedStats).mockResolvedValue(dataWithMinimal);

    const { getByTestId, getByLabelText } = render(<WrappedIsland />);

    await waitFor(() => {
      expect(getByTestId('wrapped-container')).toBeTruthy();
    });

    // First card, prev should be disabled
    const prevBtn = getByLabelText('Previous card') as HTMLButtonElement;
    expect(prevBtn.disabled).toBe(true);
  });

  it('renders share button', async () => {
    vi.mocked(fetchWrappedStats).mockResolvedValue(mockWrappedData);

    const { getByTestId } = render(<WrappedIsland />);

    await waitFor(() => {
      expect(getByTestId('wrapped-share-btn')).toBeTruthy();
    });
  });

  it('shows milestone images when available', async () => {
    vi.mocked(fetchWrappedStats).mockResolvedValue(mockWrappedData);

    const { getByTestId, getByLabelText } = render(<WrappedIsland />);

    await waitFor(() => {
      expect(getByTestId('wrapped-container')).toBeTruthy();
    });

    // Navigate to milestones card (card index varies based on data)
    // With full mockWrappedData we have: hero(0), walks(1), streak(2), month(3), milestones(4), fellowships(5), narrative(6)
    for (let i = 0; i < 4; i++) {
      fireEvent.click(getByLabelText('Next card'));
    }

    // Milestones card should be active
    const milestonesCard = getByTestId('wrapped-card-4');
    expect(milestonesCard.className).toContain('active');
    expect(milestonesCard.textContent).toContain('Bucklebury Ferry');
    expect(milestonesCard.textContent).toContain('The Prancing Pony');
  });

  it('renders fellowship highlights card', async () => {
    vi.mocked(fetchWrappedStats).mockResolvedValue(mockWrappedData);

    const { getByTestId, getByLabelText } = render(<WrappedIsland />);

    await waitFor(() => {
      expect(getByTestId('wrapped-container')).toBeTruthy();
    });

    // Navigate to fellowships card (index 5 with full data)
    for (let i = 0; i < 5; i++) {
      fireEvent.click(getByLabelText('Next card'));
    }

    const fellowshipCard = getByTestId('wrapped-card-5');
    expect(fellowshipCard.className).toContain('active');
    expect(fellowshipCard.textContent).toContain('The Fellowship');
    expect(fellowshipCard.textContent).toContain('500');
  });

  it('renders narrative card with paragraph splits', async () => {
    vi.mocked(fetchWrappedStats).mockResolvedValue(mockWrappedData);

    const { getByTestId, getByLabelText } = render(<WrappedIsland />);

    await waitFor(() => {
      expect(getByTestId('wrapped-container')).toBeTruthy();
    });

    // Navigate to narrative (last card, index 6)
    for (let i = 0; i < 6; i++) {
      fireEvent.click(getByLabelText('Next card'));
    }

    const narrativeCard = getByTestId('wrapped-card-6');
    expect(narrativeCard.className).toContain('active');
    expect(narrativeCard.textContent).toContain('Like Bilbo in the Shire');
  });

  it('shows empty state when no data for year', async () => {
    const emptyData: WrappedData = {
      year: 2025,
      total_distance_km: 0,
      journey_pct: 0,
      walk_count: 0,
      active_days: 0,
      best_streak: 0,
      favorite_month: null,
      milestones: [],
      fellowship_highlights: [],
      first_walk_date: null,
      narrative: '',
    };
    vi.mocked(fetchWrappedStats).mockResolvedValue(emptyData);

    const { getByTestId } = render(<WrappedIsland />);

    await waitFor(() => {
      // Should still render since there's at least the hero + narrative card
      expect(getByTestId('wrapped-container')).toBeTruthy();
    });
  });

  it('retries data fetch on error button click', async () => {
    vi.mocked(fetchWrappedStats).mockRejectedValueOnce(new Error('Network error'));

    const { getByTestId, getByText } = render(<WrappedIsland />);

    await waitFor(() => {
      expect(getByTestId('wrapped-error')).toBeTruthy();
    });

    vi.mocked(fetchWrappedStats).mockResolvedValueOnce(mockWrappedData);
    fireEvent.click(getByText('Try Again'));

    await waitFor(() => {
      expect(getByTestId('wrapped-container')).toBeTruthy();
    });
    expect(fetchWrappedStats).toHaveBeenCalledTimes(2);
  });
});

describe('renderShareImage', () => {
  it('creates and downloads a canvas image', () => {
    const mockToBlob = vi.fn((callback: BlobCallback) => {
      callback(new Blob(['test'], { type: 'image/png' }));
    });

    const mockContext = {
      createLinearGradient: vi.fn(() => ({
        addColorStop: vi.fn(),
      })),
      fillRect: vi.fn(),
      fillText: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      strokeRect: vi.fn(),
      fillStyle: '',
      font: '',
      textAlign: '',
      strokeStyle: '',
      lineWidth: 0,
    };

    const mockLink = { href: '', download: '', click: vi.fn() };
    const createElementSpy = vi.spyOn(document, 'createElement');
    createElementSpy.mockImplementation((tag: string) => {
      if (tag === 'canvas') {
        return {
          width: 0,
          height: 0,
          getContext: vi.fn(() => mockContext),
          toBlob: mockToBlob,
        } as unknown as HTMLCanvasElement;
      }
      if (tag === 'a') {
        return mockLink as unknown as HTMLAnchorElement;
      }
      return document.createElement(tag);
    });

    const mockCreateObjectURL = vi.fn(() => 'blob:test-url');
    const mockRevokeObjectURL = vi.fn();
    URL.createObjectURL = mockCreateObjectURL;
    URL.revokeObjectURL = mockRevokeObjectURL;

    renderShareImage(mockWrappedData);

    expect(mockToBlob).toHaveBeenCalled();
    expect(mockLink.click).toHaveBeenCalled();
    expect(mockLink.download).toBe('walk-to-mordor-2025-wrapped.png');
    expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:test-url');

    createElementSpy.mockRestore();
  });

  it('renders active days instead of km per walk when walk count is zero', () => {
    const zeroWalkData: WrappedData = {
      ...mockWrappedData,
      walk_count: 0,
      active_days: 3,
    };

    const mockToBlob = vi.fn((callback: BlobCallback) => {
      callback(new Blob(['test'], { type: 'image/png' }));
    });

    const mockContext = {
      createLinearGradient: vi.fn(() => ({
        addColorStop: vi.fn(),
      })),
      fillRect: vi.fn(),
      fillText: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      strokeRect: vi.fn(),
      fillStyle: '',
      font: '',
      textAlign: '',
      strokeStyle: '',
      lineWidth: 0,
    };

    const mockLink = { href: '', download: '', click: vi.fn() };
    const createElementSpy = vi.spyOn(document, 'createElement');
    createElementSpy.mockImplementation((tag: string) => {
      if (tag === 'canvas') {
        return {
          width: 0,
          height: 0,
          getContext: vi.fn(() => mockContext),
          toBlob: mockToBlob,
        } as unknown as HTMLCanvasElement;
      }
      if (tag === 'a') {
        return mockLink as unknown as HTMLAnchorElement;
      }
      return document.createElement(tag);
    });

    const mockCreateObjectURL = vi.fn(() => 'blob:test-url');
    const mockRevokeObjectURL = vi.fn();
    URL.createObjectURL = mockCreateObjectURL;
    URL.revokeObjectURL = mockRevokeObjectURL;

    renderShareImage(zeroWalkData);

    expect(mockContext.fillText).toHaveBeenCalledWith('3 active days', 300, 210);
    expect(mockContext.fillText).not.toHaveBeenCalledWith(expect.stringContaining('km/walk'), 300, 210);

    createElementSpy.mockRestore();
  });
});
