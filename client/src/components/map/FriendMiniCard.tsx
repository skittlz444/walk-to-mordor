/**
 * FriendMiniCard — DOM overlay popup for friend markers on the map.
 *
 * Follows the WaypointPopup.tsx pattern: an absolutely positioned HTML element
 * over the Konva canvas, using getScreenPosition/getOptimalPopupPosition for
 * placement. Shows avatar, username, distance, and a "View Profile →" link.
 *
 * Dismissible via click-outside or ESC key (coordinated with waypoint popup).
 */

import { useEffect, useRef } from 'preact/hooks';
import type { FriendMarkerData } from './FriendMarkers';

export interface FriendMiniCardProps {
  friend: FriendMarkerData;
  position: { x: number; y: number };
  onClose: () => void;
}

/**
 * Generate a deterministic HSL background for a username (same as FriendMarkers.ts).
 */
function getInitialsColor(username: string): string {
  const hue = (username.charCodeAt(0) * 137) % 360;
  return `hsl(${hue}, 50%, 35%)`;
}

export function FriendMiniCard({ friend, position, onClose }: FriendMiniCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  // Click-outside handler
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Delay to avoid the click that opened the card from immediately closing it
    const timer = setTimeout(() => {
      document.addEventListener('click', handleClickOutside, true);
    }, 50);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handleClickOutside, true);
    };
  }, [onClose]);

  // ESC key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const avatarSrc = friend.avatar_id
    ? `/img/avatars/thumbs/${friend.avatar_id}.webp`
    : null;

  const distanceDisplay = friend.total_distance.toFixed(1);

  return (
    <div
      ref={cardRef}
      class="friend-mini-card"
      style={`left:${position.x}px;top:${position.y}px;`}
      role="dialog"
      aria-label={`Friend: ${friend.username}`}
      onClick={(e: Event) => e.stopPropagation()}
    >
      <div class="friend-mini-card-content">
        <div class="friend-mini-card-avatar">
          {avatarSrc ? (
            <img
              src={avatarSrc}
              alt={`${friend.username} avatar`}
              loading="lazy"
            />
          ) : (
            <div
              class="friend-initials"
              style={`background:${getInitialsColor(friend.username)}`}
            >
              {friend.username.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <div class="friend-mini-card-info">
          <p class="friend-mini-card-name">{friend.username}</p>
          <p class="friend-mini-card-distance">{distanceDisplay} km</p>
          <a
            class="friend-mini-card-link"
            href={`/friends/${friend.user_id}`}
          >
            View Profile →
          </a>
        </div>
      </div>
    </div>
  );
}
