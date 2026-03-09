import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/preact';
import { FriendMiniCard } from '../FriendMiniCard';
import type { FriendMarkerData } from '../FriendMarkers';

describe('FriendMiniCard', () => {
  const defaultFriend: FriendMarkerData = {
    user_id: 42,
    username: 'samwise',
    avatar_id: 'samwise-avatar',
    total_distance: 245.5,
  };
  const defaultPosition = { x: 100, y: 200 };
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders username', () => {
    const { getByText } = render(
      <FriendMiniCard friend={defaultFriend} position={defaultPosition} onClose={onClose} />
    );

    expect(getByText('samwise')).toBeDefined();
  });

  it('renders total distance in km', () => {
    const { getByText } = render(
      <FriendMiniCard friend={defaultFriend} position={defaultPosition} onClose={onClose} />
    );

    expect(getByText('245.5 km')).toBeDefined();
  });

  it('renders "View Profile →" link with correct href', () => {
    const { getByText } = render(
      <FriendMiniCard friend={defaultFriend} position={defaultPosition} onClose={onClose} />
    );

    const link = getByText('View Profile →');
    expect(link).toBeDefined();
    expect(link.getAttribute('href')).toBe('/friends/42');
  });

  it('renders avatar image when avatar_id is set', () => {
    const { container } = render(
      <FriendMiniCard friend={defaultFriend} position={defaultPosition} onClose={onClose} />
    );

    const img = container.querySelector('.friend-mini-card-avatar img') as HTMLImageElement;
    expect(img).toBeTruthy();
    expect(img.src).toContain('/img/avatars/thumbs/samwise-avatar.webp');
  });

  it('renders initials fallback when avatar_id is null', () => {
    const noAvatarFriend: FriendMarkerData = {
      user_id: 99,
      username: 'frodo',
      avatar_id: null,
      total_distance: 180.2,
    };

    const { container } = render(
      <FriendMiniCard friend={noAvatarFriend} position={defaultPosition} onClose={onClose} />
    );

    const initials = container.querySelector('.friend-initials');
    expect(initials).toBeTruthy();
    expect(initials!.textContent).toBe('F');
  });

  it('positions at the given coordinates', () => {
    const { container } = render(
      <FriendMiniCard friend={defaultFriend} position={{ x: 150, y: 300 }} onClose={onClose} />
    );

    const card = container.querySelector('.friend-mini-card') as HTMLElement;
    expect(card.style.left).toBe('150px');
    expect(card.style.top).toBe('300px');
  });

  it('has correct ARIA role and label', () => {
    const { container } = render(
      <FriendMiniCard friend={defaultFriend} position={defaultPosition} onClose={onClose} />
    );

    const card = container.querySelector('.friend-mini-card') as HTMLElement;
    expect(card.getAttribute('role')).toBe('dialog');
    expect(card.getAttribute('aria-label')).toBe('Friend: samwise');
  });

  it('calls onClose on ESC key press', async () => {
    render(
      <FriendMiniCard friend={defaultFriend} position={defaultPosition} onClose={onClose} />
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('stops event propagation when clicking inside the card', () => {
    const { container } = render(
      <FriendMiniCard friend={defaultFriend} position={defaultPosition} onClose={onClose} />
    );

    const card = container.querySelector('.friend-mini-card') as HTMLElement;
    const event = new MouseEvent('click', { bubbles: true });
    const stopProp = vi.spyOn(event, 'stopPropagation');
    card.dispatchEvent(event);
    expect(stopProp).toHaveBeenCalled();
  });

  it('formats distance with one decimal place', () => {
    const friend: FriendMarkerData = {
      user_id: 1,
      username: 'pippin',
      avatar_id: null,
      total_distance: 0,
    };

    const { getByText } = render(
      <FriendMiniCard friend={friend} position={defaultPosition} onClose={onClose} />
    );

    expect(getByText('0.0 km')).toBeDefined();
  });
});
