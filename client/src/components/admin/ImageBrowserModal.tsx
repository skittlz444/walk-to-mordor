import { useState, useEffect, useCallback, useRef } from 'preact/hooks';

interface ImageBrowserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (slug: string) => void;
  currentImageId: string;
}

interface GoalImageAssignment {
  image_id: string;
  title: string;
}

/**
 * Modal for browsing and selecting available image assets.
 * Fetches the image manifest and shows a filterable grid of thumbnails.
 * Displays which images are already assigned to other goals.
 */
export function ImageBrowserModal({ isOpen, onClose, onSelect, currentImageId }: ImageBrowserModalProps) {
  const [slugs, setSlugs] = useState<string[]>([]);
  const [assignedMap, setAssignedMap] = useState<Map<string, string>>(new Map());
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Fetch manifest and goal assignments when modal opens
  useEffect(() => {
    if (!isOpen) return;

    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setFilter('');

    const loadData = async () => {
      try {
        // Fetch manifest and goals list in parallel
        const [manifestRes, goalsRes] = await Promise.all([
          fetch('/img/image-manifest.json', { signal: controller.signal }),
          fetch('/api/admin/goals?pageSize=100', {
            headers: getAuthHeaders(),
            signal: controller.signal,
          }),
        ]);

        if (!manifestRes.ok) {
          setError('Could not load image manifest. Run npm run build:manifest.');
          setLoading(false);
          return;
        }

        const manifest = await manifestRes.json() as { images: string[] };
        setSlugs(manifest.images);

        // Build map of image_id -> goal title for "in use" indicators
        if (goalsRes.ok) {
          const goalsData = await goalsRes.json() as { goals: GoalImageAssignment[]; totalPages: number };
          const map = new Map<string, string>();

          // Fetch remaining pages if needed
          let allGoals = goalsData.goals;
          if (goalsData.totalPages > 1) {
            const pagePromises: Promise<Response>[] = [];
            for (let p = 2; p <= goalsData.totalPages; p++) {
              pagePromises.push(
                fetch(`/api/admin/goals?pageSize=100&page=${p}`, {
                  headers: getAuthHeaders(),
                  signal: controller.signal,
                })
              );
            }
            const pageResults = await Promise.all(pagePromises);
            for (const pageRes of pageResults) {
              if (pageRes.ok) {
                const pageData = await pageRes.json() as { goals: GoalImageAssignment[] };
                allGoals = allGoals.concat(pageData.goals);
              }
            }
          }

          for (const g of allGoals) {
            if (g.image_id) {
              map.set(g.image_id, g.title);
            }
          }
          setAssignedMap(map);
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setError('Failed to load image data.');
        }
      } finally {
        setLoading(false);
      }
    };

    loadData();

    return () => controller.abort();
  }, [isOpen]);

  // Focus search input when modal opens
  useEffect(() => {
    if (isOpen && !loading && searchRef.current) {
      searchRef.current.focus();
    }
  }, [isOpen, loading]);

  // ESC key handler
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const handleBackdropClick = useCallback((e: MouseEvent) => {
    if (e.target === backdropRef.current) onClose();
  }, [onClose]);

  const handleSelect = useCallback((slug: string) => {
    onSelect(slug);
    onClose();
  }, [onSelect, onClose]);

  if (!isOpen) return null;

  const filteredSlugs = filter
    ? slugs.filter(s => s.toLowerCase().includes(filter.toLowerCase()))
    : slugs;

  return (
    <div
      className="admin-image-browser"
      ref={backdropRef}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label="Browse Images"
    >
      <div className="admin-image-browser__content">
        <div className="admin-image-browser__header">
          <h3>Browse Images</h3>
          <button
            type="button"
            className="admin-image-browser__close"
            onClick={onClose}
            aria-label="Close image browser"
          >
            ×
          </button>
        </div>

        <div className="admin-image-browser__search">
          <input
            ref={searchRef}
            type="text"
            placeholder="Search by slug name..."
            value={filter}
            onInput={(e) => setFilter((e.target as HTMLInputElement).value)}
            className="admin-image-browser__search-input"
          />
          <small className="admin-image-browser__count">
            {filteredSlugs.length} of {slugs.length} images
          </small>
        </div>

        {loading && (
          <div className="admin-loading" style={{ padding: '2rem', textAlign: 'center' }}>
            <i className="fas fa-spinner fa-spin" aria-hidden="true"></i> Loading images...
          </div>
        )}

        {error && (
          <div className="admin-image-warning" role="alert" style={{ margin: '1rem' }}>
            <i className="fas fa-exclamation-triangle" aria-hidden="true"></i> {error}
          </div>
        )}

        {!loading && !error && (
          <div className="admin-image-grid">
            {filteredSlugs.map(slug => {
              const assignedTo = assignedMap.get(slug);
              const isCurrent = slug === currentImageId;
              return (
                <button
                  key={slug}
                  type="button"
                  className={`admin-image-tile${isCurrent ? ' selected' : ''}${assignedTo && !isCurrent ? ' in-use' : ''}`}
                  onClick={() => handleSelect(slug)}
                  title={assignedTo ? `In use by: ${assignedTo}` : slug}
                >
                  <img
                    src={`/img/thumbs/${slug}-thumb.webp`}
                    alt={slug}
                    loading="lazy"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                  <span className="admin-image-tile__label">{slug}</span>
                  {assignedTo && !isCurrent && (
                    <span className="admin-image-tile__badge">In use</span>
                  )}
                  {isCurrent && (
                    <span className="admin-image-tile__badge admin-image-tile__badge--current">Current</span>
                  )}
                </button>
              );
            })}
            {filteredSlugs.length === 0 && (
              <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '2rem', color: 'var(--text-muted, #888)' }}>
                No images match &quot;{filter}&quot;
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('sessionToken');
  return token
    ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };
}
