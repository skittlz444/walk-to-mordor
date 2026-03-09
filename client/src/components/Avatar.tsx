/**
 * Reusable Avatar component for displaying user avatars across all islands.
 *
 * - Image mode: renders a circular WebP avatar image
 * - Initials fallback: renders a colored circle with the user's first initial
 *
 * Supported sizes: 24 (fellowship members), 32 (friends list, drawer),
 *                  64 (map mini-card), 128 (profile settings, friend profile)
 */

interface AvatarProps {
  /** Avatar slug (null/undefined = initials fallback) */
  avatarId: string | null | undefined;
  /** Username for alt text and initials fallback */
  username: string;
  /** Size in pixels */
  size: number;
}

function getAvatarBg(username: string): string {
  const firstChar = username?.charAt(0) || '?';
  const hue = (firstChar.charCodeAt(0) * 137) % 360;
  return `hsl(${hue}, 50%, 35%)`;
}

export function Avatar({ avatarId, username, size }: AvatarProps) {
  const fontSize = size >= 128 ? '3rem' : size >= 64 ? '1.5rem' : size >= 32 ? '0.85rem' : '0.65rem';

  if (avatarId) {
    return (
      <div
        className="avatar"
        style={{
          width: `${size}px`,
          height: `${size}px`,
          borderRadius: '50%',
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
        <img
          src={`/img/avatars/${avatarId}.webp`}
          alt={username}
          width={size}
          height={size}
          style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </div>
    );
  }

  return (
    <div
      className="avatar avatar--initials"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '50%',
        backgroundColor: getAvatarBg(username),
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize,
        fontWeight: 600,
        flexShrink: 0,
        lineHeight: 1,
      }}
      role="img"
      aria-label={username}
    >
      {(username?.charAt(0) || '?').toUpperCase()}
    </div>
  );
}
