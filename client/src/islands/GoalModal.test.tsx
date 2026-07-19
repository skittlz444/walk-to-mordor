import { render, screen, waitFor } from '@testing-library/preact';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GoalModal } from './GoalModal';

describe('GoalModal', () => {
  const mockGoal = {
    id: 1,
    distance: 100.5,
    title: 'Test Goal',
    special: null,
    description: 'A test goal description',
    image_id: '1',
  };

  const mockOnClose = vi.fn();

  beforeEach(() => {
    mockOnClose.mockClear();
  });

  it('renders modal with goal information', () => {
    render(
      <GoalModal
        goal={mockGoal}
        currentDistance={50}
        isCongratulations={false}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText('Test Goal')).toBeTruthy();
    expect(screen.getByText('100.50 km')).toBeTruthy();
    expect(screen.getByText('50.50 km to go')).toBeTruthy();
    expect(screen.getByText('A test goal description')).toBeTruthy();
  });

  it('shows congratulations message when isCongratulations is true', () => {
    render(
      <GoalModal
        goal={mockGoal}
        currentDistance={50}
        isCongratulations={true}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText(/Congratulations! You've passed a new goal!/)).toBeTruthy();
  });

  it('displays special text when goal has special field', () => {
    const specialGoal = { ...mockGoal, special: 'Special Achievement!' };
    
    render(
      <GoalModal
        goal={specialGoal}
        currentDistance={50}
        isCongratulations={false}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText('Special Achievement!')).toBeTruthy();
  });

  it('applies strikethrough style for completed goals', () => {
    render(
      <GoalModal
        goal={mockGoal}
        currentDistance={150}
        isCongratulations={false}
        onClose={mockOnClose}
      />
    );

    const distanceElement = screen.getByText('100.50 km');
    expect(distanceElement.getAttribute('style')).toContain('text-decoration: line-through');
  });

  it('does not show "to go" text for completed goals', () => {
    render(
      <GoalModal
        goal={mockGoal}
        currentDistance={150}
        isCongratulations={false}
        onClose={mockOnClose}
      />
    );

    expect(screen.queryByText(/km to go/)).toBeFalsy();
  });

  it('renders images with correct src paths', () => {
    render(
      <GoalModal
        goal={mockGoal}
        currentDistance={50}
        isCongratulations={false}
        onClose={mockOnClose}
      />
    );

    const highResImages = screen.getAllByAltText('Goal image') as HTMLImageElement[];
    expect(highResImages[0].src).toContain('/img/thumbs/1-thumb.webp');
    expect(highResImages[1].src).toContain('/img/highres/1.webp');
  });

  it('renders placeholder image when image_id is null', () => {
    const goalWithoutImage = { ...mockGoal, image_id: null };
    
    render(
      <GoalModal
        goal={goalWithoutImage}
        currentDistance={50}
        isCongratulations={false}
        onClose={mockOnClose}
      />
    );

    // Should render images with placeholder (id='0') in webp format first
    const images = screen.getAllByAltText('Goal image') as HTMLImageElement[];
    expect(images.length).toBe(2);
    expect(images[0].src).toContain('/img/thumbs/0-thumb.webp');
    expect(images[1].src).toContain('/img/highres/0.webp');
  });

  it('falls back to .jpg when .webp fails to load', () => {
    const goalWithWebpUnavailable = { ...mockGoal, image_id: '999' };
    
    render(
      <GoalModal
        goal={goalWithWebpUnavailable}
        currentDistance={50}
        isCongratulations={false}
        onClose={mockOnClose}
      />
    );

    const images = screen.getAllByAltText('Goal image') as HTMLImageElement[];
    
    // Initially loads .webp
    expect(images[0].src).toContain('/img/thumbs/999-thumb.webp');
    expect(images[1].src).toContain('/img/highres/999.webp');
    
    // Trigger error on thumbnail - should try .jpg
    const thumbImage = images[0];
    const errorEvent = new Event('error');
    thumbImage.dispatchEvent(errorEvent);
    expect(thumbImage.src).toContain('/img/thumbs/999-thumb.jpg');
    
    // Trigger error on high-res - should try .jpg
    const highResImage = images[1];
    highResImage.dispatchEvent(errorEvent);
    expect(highResImage.src).toContain('/img/highres/999.jpg');
  });

  it('falls back to placeholder when both .webp and .jpg fail to load', () => {
    const goalWithBadImage = { ...mockGoal, image_id: '999' };
    
    render(
      <GoalModal
        goal={goalWithBadImage}
        currentDistance={50}
        isCongratulations={false}
        onClose={mockOnClose}
      />
    );

    const images = screen.getAllByAltText('Goal image') as HTMLImageElement[];
    
    // Trigger first error on thumbnail (.webp fails, tries .jpg)
    const thumbImage = images[0];
    const errorEvent = new Event('error');
    thumbImage.dispatchEvent(errorEvent);
    expect(thumbImage.src).toContain('/img/thumbs/999-thumb.jpg');
    
    // Trigger second error on thumbnail (.jpg fails, goes to placeholder)
    thumbImage.dispatchEvent(errorEvent);
    expect(thumbImage.src).toContain('/img/thumbs/0-thumb.webp');
    
    // Trigger first error on high-res (.webp fails, tries .jpg)
    const highResImage = images[1];
    highResImage.dispatchEvent(errorEvent);
    expect(highResImage.src).toContain('/img/highres/999.jpg');
    
    // Trigger second error on high-res (.jpg fails, goes to placeholder)
    highResImage.dispatchEvent(errorEvent);
    expect(highResImage.src).toContain('/img/highres/0.webp');
  });

  it('calls onClose when Close button is clicked', () => {
    render(
      <GoalModal
        goal={mockGoal}
        currentDistance={50}
        isCongratulations={false}
        onClose={mockOnClose}
      />
    );

    const closeButton = screen.getByText('Close');
    closeButton.click();

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when overlay is clicked', () => {
    render(
      <GoalModal
        goal={mockGoal}
        currentDistance={50}
        isCongratulations={false}
        onClose={mockOnClose}
      />
    );

    const overlay = document.querySelector('.modal-overlay') as HTMLElement;
    overlay.click();

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose when modal content is clicked', () => {
    render(
      <GoalModal
        goal={mockGoal}
        currentDistance={50}
        isCongratulations={false}
        onClose={mockOnClose}
      />
    );

    const modalContent = document.querySelector('.modal-content') as HTMLElement;
    modalContent.click();

    expect(mockOnClose).not.toHaveBeenCalled();
  });

  it('handles goals without description', () => {
    const goalWithoutDescription = { ...mockGoal, description: null };
    
    render(
      <GoalModal
        goal={goalWithoutDescription}
        currentDistance={50}
        isCongratulations={false}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText('Test Goal')).toBeTruthy();
    expect(screen.queryByText('A test goal description')).toBeFalsy();
  });

  it('calculates distance to go correctly', () => {
    render(
      <GoalModal
        goal={mockGoal}
        currentDistance={30.25}
        isCongratulations={false}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText('70.25 km to go')).toBeTruthy();
  });

  it('applies correct gold color for non-completed goals', () => {
    render(
      <GoalModal
        goal={mockGoal}
        currentDistance={50}
        isCongratulations={false}
        onClose={mockOnClose}
      />
    );

    const distanceElement = screen.getByText('100.50 km');
    expect(distanceElement.getAttribute('style')).toContain('color: #FFD700');
  });

  it('calls onClose when Escape key is pressed', () => {
    render(
      <GoalModal
        goal={mockGoal}
        currentDistance={50}
        isCongratulations={false}
        onClose={mockOnClose}
      />
    );

    // Simulate Escape key press
    const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape' });
    document.dispatchEvent(escapeEvent);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  // --- Story 9.1: Locked Milestone Card Previews ---

  it('locked=true renders thumbnail with blur(12px) filter', () => {
    render(
      <GoalModal
        goal={mockGoal}
        currentDistance={50}
        isCongratulations={false}
        locked={true}
        onClose={mockOnClose}
      />
    );

    const thumbImage = document.querySelector('#goal-thumb-image') as HTMLImageElement;
    expect(thumbImage.style.filter).toContain('blur(12px)');
    expect(thumbImage.style.filter).toContain('brightness(0.6)');
    expect(thumbImage.style.transform).toContain('scale(1.1)');
  });

  it('locked=true does NOT render high-res image', () => {
    render(
      <GoalModal
        goal={mockGoal}
        currentDistance={50}
        isCongratulations={false}
        locked={true}
        onClose={mockOnClose}
      />
    );

    const highResImage = document.querySelector('#goal-highres-image');
    expect(highResImage).toBeNull();
  });

  it('locked=true shows lock icon overlay', () => {
    render(
      <GoalModal
        goal={mockGoal}
        currentDistance={50}
        isCongratulations={false}
        locked={true}
        onClose={mockOnClose}
      />
    );

    const lockIcon = document.querySelector('.fas.fa-lock');
    expect(lockIcon).toBeTruthy();
  });

  it('locked=true obscures description with transparent color', () => {
    render(
      <GoalModal
        goal={mockGoal}
        currentDistance={50}
        isCongratulations={false}
        locked={true}
        onClose={mockOnClose}
      />
    );

    const descriptionEl = screen.getByText('A test goal description');
    expect(descriptionEl.style.color).toBe('transparent');
    expect(descriptionEl.style.userSelect).toBe('none');
  });

  it('locked=true sets aria-hidden on description', () => {
    render(
      <GoalModal
        goal={mockGoal}
        currentDistance={50}
        isCongratulations={false}
        locked={true}
        onClose={mockOnClose}
      />
    );

    const descriptionEl = screen.getByText('A test goal description');
    expect(descriptionEl.getAttribute('aria-hidden')).toBe('true');
  });

  it('locked=false (default) renders normally without lock icon or blur', () => {
    render(
      <GoalModal
        goal={mockGoal}
        currentDistance={50}
        isCongratulations={false}
        onClose={mockOnClose}
      />
    );

    const lockIcon = document.querySelector('.fas.fa-lock');
    expect(lockIcon).toBeNull();

    const highResImage = document.querySelector('#goal-highres-image');
    expect(highResImage).toBeTruthy();

    const descriptionEl = screen.getByText('A test goal description');
    expect(descriptionEl.getAttribute('aria-hidden')).toBeNull();
  });

  it('modal has role="dialog" and aria-label', () => {
    render(
      <GoalModal
        goal={mockGoal}
        currentDistance={50}
        isCongratulations={false}
        onClose={mockOnClose}
      />
    );

    const dialog = document.querySelector('.modal-dialog') as HTMLElement;
    expect(dialog.getAttribute('role')).toBe('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-label')).toBe('Goal: Test Goal');
  });
});

// ── Goal Content Tests ──────────────────────────────────────────────────────

describe('GoalModal content', () => {
  const mockGoal = {
    id: 7,
    distance: 100.5,
    title: 'Lore Goal',
    special: null,
    description: 'A lore-rich goal',
    image_id: '1',
    has_content: true,
  };

  const mockOnClose = vi.fn();
  let fetchMock: ReturnType<typeof vi.fn>;

  const journalPayload = {
    ownEntry: null,
    friendEntries: [],
    permissions: {
      canWrite: false,
      canEditOwn: false,
      canDeleteOwn: false,
      canReadFriends: false,
    },
  };

  beforeEach(() => {
    mockOnClose.mockClear();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function mockContentResponses(entries: Array<Record<string, unknown>>) {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/content/events')) {
        return Promise.resolve({ ok: true, status: 202, json: () => Promise.resolve({}) });
      }
      if (url.includes('/content')) {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ entries }) });
      }
      if (url.includes('/journals')) {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(journalPayload) });
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) });
    });
  }

  it('renders unlocked content entries by type in sort order', async () => {
    mockContentResponses([
      {
        id: 3,
        goal_id: 7,
        type: 'appendix',
        title: 'Appendix Note',
        body: 'Reference **facts**.',
        author_attribution: 'Archivist',
        sort_order: 3,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
      {
        id: 1,
        goal_id: 7,
        type: 'story',
        title: 'Campfire Tale',
        body: 'A **warm** story.',
        author_attribution: null,
        sort_order: 1,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
      {
        id: 2,
        goal_id: 7,
        type: 'poetry',
        title: 'Walking Song',
        body: 'Line one\n\nLine two',
        author_attribution: null,
        sort_order: 2,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    ]);

    const { container } = render(
      <GoalModal
        goal={mockGoal}
        currentDistance={150}
        onClose={mockOnClose}
      />
    );

    // Panel renders collapsed by default with a summary of counts.
    await waitFor(() => {
      expect(screen.getByText('Campfire Lore')).toBeTruthy();
      expect(screen.getByText('1 story')).toBeTruthy();
      expect(screen.getByText('1 poem')).toBeTruthy();
      expect(screen.getByText('1 appendix')).toBeTruthy();
    });
    expect(screen.queryByText('Campfire Tale')).toBeNull();

    // Expand to reveal entries.
    (container.querySelector('.goal-content-toggle') as HTMLButtonElement).click();

    await waitFor(() => {
      expect(screen.getByText('Campfire Tale')).toBeTruthy();
      expect(screen.getByText('Walking Song')).toBeTruthy();
      expect(screen.getByText('Appendix Note')).toBeTruthy();
    });

    const titles = Array.from(container.querySelectorAll('.goal-content-entry h4')).map((el) => el.textContent);
    expect(titles).toEqual(['Campfire Tale', 'Walking Song', 'Appendix Note']);
    expect(screen.getByText('Campfire Story')).toBeTruthy();
    expect(screen.getByText('Poetry')).toBeTruthy();
    expect(screen.getByText('Appendix')).toBeTruthy();
    expect(container.querySelector('.goal-content-entry--story strong')?.textContent).toBe('warm');
    expect(screen.getByText(/Archivist/)).toBeTruthy();
  });

  it('collapses and expands appendices over 500 rendered words', async () => {
    const longBody = Array.from({ length: 501 }, (_, index) => `word${index + 1}`).join(' ');
    mockContentResponses([
      {
        id: 9,
        goal_id: 7,
        type: 'appendix',
        title: 'Long Appendix',
        body: longBody,
        author_attribution: null,
        sort_order: 1,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    ]);

    const { container } = render(
      <GoalModal
        goal={mockGoal}
        currentDistance={150}
        onClose={mockOnClose}
      />
    );

    // Expand the collapsed lore panel first.
    await waitFor(() => {
      expect(screen.getByText('Campfire Lore')).toBeTruthy();
    });
    (container.querySelector('.goal-content-toggle') as HTMLButtonElement).click();

    await waitFor(() => {
      expect(screen.getByText('Long Appendix')).toBeTruthy();
      expect(screen.getByText('Expand appendix')).toBeTruthy();
    });

    expect(screen.queryByText((content) => content.includes('word501'))).toBeNull();

    screen.getByText('Expand appendix').click();

    await waitFor(() => {
      expect(screen.getByText((content) => content.includes('word501'))).toBeTruthy();
      expect(screen.getByText('Collapse appendix')).toBeTruthy();
    });
  });
});

// ── Journal Tests ──────────────────────────────────────────────────────────

describe('GoalModal Journal', () => {
  const mockGoal = {
    id: 1,
    distance: 100.5,
    title: 'Test Goal',
    special: null,
    description: 'A test goal description',
    image_id: '1',
  };

  const mockOnClose = vi.fn();
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOnClose.mockClear();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function mockJournalResponse(data: Record<string, unknown>, status = 200) {
    fetchMock.mockResolvedValueOnce({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(data),
    });
  }

  it('shows loading state while fetching journal', async () => {
    fetchMock.mockImplementationOnce(() => new Promise(() => {})); // never resolves

    render(
      <GoalModal
        goal={mockGoal}
        currentDistance={150}
        onClose={mockOnClose}
      />
    );

    // Click the Journals button to trigger fetch
    const journalsBtn = screen.getByText('Journals');
    journalsBtn.click();

    await waitFor(() => {
      expect(screen.getByText('Loading journal...')).toBeTruthy();
    });
  });

  it('shows error state when journal fetch fails', async () => {
    fetchMock.mockRejectedValueOnce(new Error('Network error'));

    render(
      <GoalModal
        goal={mockGoal}
        currentDistance={150}
        onClose={mockOnClose}
      />
    );

    // Click Journals button
    screen.getByText('Journals').click();

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeTruthy();
    });
  });

  it('shows create state when no entry exists and user has write access', async () => {
    mockJournalResponse({
      ownEntry: null,
      friendEntries: [],
      permissions: {
        canWrite: true,
        canEditOwn: false,
        canDeleteOwn: false,
        canReadFriends: false,
      },
    });

    render(
      <GoalModal
        goal={mockGoal}
        currentDistance={150}
        onClose={mockOnClose}
      />
    );

    screen.getByText('Journals').click();

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Write your reflection on reaching this milestone...')).toBeTruthy();
    });
  });

  it('shows view state when own entry exists', async () => {
    mockJournalResponse({
      ownEntry: {
        id: 1,
        body: 'Amazing milestone!',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
      friendEntries: [],
      permissions: {
        canWrite: false,
        canEditOwn: true,
        canDeleteOwn: true,
        canReadFriends: false,
      },
    });

    render(
      <GoalModal
        goal={mockGoal}
        currentDistance={150}
        onClose={mockOnClose}
      />
    );

    screen.getByText('Journals').click();

    await waitFor(() => {
      expect(screen.getByText('Amazing milestone!')).toBeTruthy();
      // The journal view header uses 📖 Your Journal
      expect(screen.getByText(/Your Journal/)).toBeTruthy();
    });
  });

  it('shows Edit and Delete buttons when permissions allow', async () => {
    mockJournalResponse({
      ownEntry: {
        id: 1,
        body: 'Amazing milestone!',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
      friendEntries: [],
      permissions: {
        canWrite: false,
        canEditOwn: true,
        canDeleteOwn: true,
        canReadFriends: false,
      },
    });

    render(
      <GoalModal
        goal={mockGoal}
        currentDistance={150}
        onClose={mockOnClose}
      />
    );

    screen.getByText('Journals').click();

    await waitFor(() => {
      expect(screen.getByText('Edit')).toBeTruthy();
      expect(screen.getByText('Delete')).toBeTruthy();
    });
  });

  it('shows friends journal section with visible entries', async () => {
    mockJournalResponse({
      ownEntry: null,
      friendEntries: [
        {
          userId: 2,
          username: 'friend1',
          avatarId: null,
          body: 'Great goal!',
          created_at: '2026-01-02T00:00:00Z',
          updated_at: '2026-01-02T00:00:00Z',
        },
      ],
      permissions: {
        canWrite: false,
        canEditOwn: false,
        canDeleteOwn: false,
        canReadFriends: true,
      },
    });

    render(
      <GoalModal
        goal={mockGoal}
        currentDistance={150}
        onClose={mockOnClose}
      />
    );

    screen.getByText('Journals').click();

    await waitFor(() => {
      expect(screen.getByText(/Friends' Journals/)).toBeTruthy();
      expect(screen.getByText('friend1')).toBeTruthy();
      expect(screen.getByText('Great goal!')).toBeTruthy();
    });
  });

  it('hides journal button when locked', () => {
    render(
      <GoalModal
        goal={mockGoal}
        currentDistance={50}
        locked={true}
        onClose={mockOnClose}
      />
    );

    // Journals button should not be present when locked
    expect(screen.queryByText('Journals')).toBeFalsy();
  });

  it('shows locked message when goal not reached and no write access', async () => {
    mockJournalResponse({
      ownEntry: null,
      friendEntries: [],
      permissions: {
        canWrite: false,
        canEditOwn: false,
        canDeleteOwn: false,
        canReadFriends: false,
      },
    });

    render(
      <GoalModal
        goal={mockGoal}
        currentDistance={50}
        onClose={mockOnClose}
      />
    );

    screen.getByText('Journals').click();

    await waitFor(() => {
      expect(screen.getByText(/Reach this goal/)).toBeTruthy();
    });
  });

  it('renders journal body with preserved line breaks', async () => {
    mockJournalResponse({
      ownEntry: {
        id: 1,
        body: 'Line one\nLine two\nLine three',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
      friendEntries: [],
      permissions: {
        canWrite: false,
        canEditOwn: true,
        canDeleteOwn: true,
        canReadFriends: false,
      },
    });

    render(
      <GoalModal
        goal={mockGoal}
        currentDistance={150}
        onClose={mockOnClose}
      />
    );

    screen.getByText('Journals').click();

    await waitFor(() => {
      const entry = screen.getByText(/Line one/);
      expect(entry).toBeTruthy();
      expect(entry.textContent).toContain('Line two');
      expect(entry.textContent).toContain('Line three');
    });
  });

  it('shows Back to Goal button when viewing journal', async () => {
    mockJournalResponse({
      ownEntry: null,
      friendEntries: [],
      permissions: {
        canWrite: false,
        canEditOwn: false,
        canDeleteOwn: false,
        canReadFriends: false,
      },
    });

    render(
      <GoalModal
        goal={mockGoal}
        currentDistance={150}
        onClose={mockOnClose}
      />
    );

    screen.getByText('Journals').click();

    await waitFor(() => {
      expect(screen.getByText('Back to Goal')).toBeTruthy();
    });
  });

  it('returns to goal details when Back to Goal is clicked', async () => {
    mockJournalResponse({
      ownEntry: null,
      friendEntries: [],
      permissions: {
        canWrite: false,
        canEditOwn: false,
        canDeleteOwn: false,
        canReadFriends: false,
      },
    });

    render(
      <GoalModal
        goal={mockGoal}
        currentDistance={150}
        onClose={mockOnClose}
      />
    );

    // Journals button visible
    expect(screen.getByText('Journals')).toBeTruthy();

    // Click to journal view
    screen.getByText('Journals').click();

    await waitFor(() => {
      expect(screen.getByText('Back to Goal')).toBeTruthy();
    });

    // Click back
    screen.getByText('Back to Goal').click();

    // Journals button should be visible again
    await waitFor(() => {
      expect(screen.getByText('Journals')).toBeTruthy();
    });
  });
});
