import { useSignal, useComputed } from '@preact/signals';
import { useEffect, useRef, useCallback } from 'preact/hooks';
import { isAdmin, storeInitialized, isAuthenticated } from '../stores/appStore';
import { fetchWrappedStats, type WrappedData, type WrappedMilestone } from '../utils/wrapped';

type WrappedState = 'idle' | 'loading' | 'loaded' | 'error';

/**
 * Renders a progressively loaded milestone image.
 * Uses a blurred thumbnail first, fading in the high-res image when loaded.
 */
function WrappedMilestoneImage({ m }: { m: WrappedMilestone }) {
  const highResLoaded = useSignal(false);
  const thumbFormat = useSignal<'webp' | 'jpg'>('webp');
  const highResFormat = useSignal<'webp' | 'jpg'>('webp');

  const handleHighResLoad = () => {
    highResLoaded.value = true;
  };

  const handleThumbError = (e: preact.JSX.TargetedEvent<HTMLImageElement, Event>) => {
    const img = e.currentTarget as HTMLImageElement;
    if (thumbFormat.value === 'webp') {
      thumbFormat.value = 'jpg';
      img.src = `/img/thumbs/${m.image_id}-thumb.jpg`;
    } else if (!img.src.endsWith('0-thumb.webp')) {
      img.src = '/img/thumbs/0-thumb.webp';
    }
  };

  const handleHighResError = (e: preact.JSX.TargetedEvent<HTMLImageElement, Event>) => {
    const img = e.currentTarget as HTMLImageElement;
    if (highResFormat.value === 'webp') {
      highResFormat.value = 'jpg';
      img.src = `/img/highres/${m.image_id}.jpg`;
    } else if (!img.src.endsWith('0.webp')) {
      img.src = '/img/highres/0.webp';
    }
  };

  return (
    <div class="wrapped-milestone-img" style={{ position: 'relative', margin: '0 auto 15px', overflow: 'hidden' }}>
      <img
        src={`/img/thumbs/${m.image_id}-thumb.${thumbFormat.value}`}
        alt=""
        style={{
          width: '100%',
          height: '100%',
          filter: highResLoaded.value ? 'none' : 'blur(2px)',
          transition: 'filter 0.3s ease',
          objectFit: 'cover'
        }}
        onError={handleThumbError}
        loading="lazy"
      />
      <img
        src={`/img/highres/${m.image_id}.${highResFormat.value}`}
        alt=""
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          opacity: highResLoaded.value ? '1' : '0',
          transition: 'opacity 0.5s ease'
        }}
        onLoad={handleHighResLoad}
        onError={handleHighResError}
        loading="lazy"
      />
    </div>
  );
}

/**
 * WrappedIsland — Year-End Review experience.
 *
 * Admin-only Preact island that displays a multi-page card sequence
 * summarizing the user's annual walking journey.
 */
export function WrappedIsland() {
  const state = useSignal<WrappedState>('idle');
  const data = useSignal<WrappedData | null>(null);
  const error = useSignal<string | null>(null);
  const currentCard = useSignal(0);
  const cardsContainerRef = useRef<HTMLDivElement>(null);

  // Touch/swipe tracking
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  const year = useSignal(new Date().getFullYear());

  const cards = useComputed(() => {
    if (!data.value) return [];
    return buildCards(data.value);
  });

  const totalCards = useComputed(() => cards.value.length);

  useEffect(() => {
    if (!storeInitialized.value || !isAuthenticated.value || !isAdmin.value) return;
    loadData();
  }, []);

  function loadData() {
    state.value = 'loading';
    error.value = null;
    fetchWrappedStats(year.value)
      .then((result) => {
        data.value = result;
        state.value = 'loaded';
        currentCard.value = 0;
      })
      .catch((err: Error) => {
        error.value = err.message;
        state.value = 'error';
      });
  }

  function nextCard() {
    if (currentCard.value < totalCards.value - 1) {
      currentCard.value++;
      scrollToCard(currentCard.value);
    }
  }

  function prevCard() {
    if (currentCard.value > 0) {
      currentCard.value--;
      scrollToCard(currentCard.value);
    }
  }

  function scrollToCard(index: number) {
    const container = cardsContainerRef.current;
    if (!container) return;
    const cardEl = container.children[index] as HTMLElement | undefined;
    if (cardEl) {
      cardEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }

  const handleTouchStart = useCallback((e: TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    // Only trigger swipe if horizontal movement > vertical and > threshold
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
      if (dx < 0) nextCard();
      else prevCard();
    }
  }, []);

  const handleShare = useCallback(() => {
    if (!data.value) return;
    renderShareImage(data.value);
  }, []);

  if (!storeInitialized.value) return null;
  if (!isAuthenticated.value) return null;
  if (!isAdmin.value) return null;

  if (state.value === 'idle' || state.value === 'loading') {
    return (
      <div class="wrapped-loading" data-testid="wrapped-loading">
        <p>Loading your year in review...</p>
      </div>
    );
  }

  if (state.value === 'error') {
    return (
      <div class="wrapped-error" data-testid="wrapped-error">
        <p>Could not load your year in review: {error.value}</p>
        <button onClick={loadData}>Try Again</button>
      </div>
    );
  }

  if (!data.value || cards.value.length === 0) {
    return (
      <div class="wrapped-empty" data-testid="wrapped-empty">
        <p>No walking data found for {year.value}.</p>
      </div>
    );
  }

  return (
    <div
      class="wrapped-container"
      data-testid="wrapped-container"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div class="wrapped-header">
        <h2>Your {data.value.year} Year in Review</h2>
        <div class="wrapped-progress">
          {currentCard.value + 1} / {totalCards.value}
        </div>
      </div>

      <div class="wrapped-cards" ref={cardsContainerRef} data-testid="wrapped-cards">
        {cards.value.map((card, i) => (
          <div
            key={i}
            class={`wrapped-card${i === currentCard.value ? ' active' : ''}`}
            data-testid={`wrapped-card-${i}`}
          >
            <div class="wrapped-card-content">
              <h3>{card.title}</h3>
              <div class="wrapped-card-body">{card.body}</div>
            </div>
          </div>
        ))}
      </div>

      <div class="wrapped-nav">
        <button
          class="wrapped-nav-btn"
          onClick={prevCard}
          disabled={currentCard.value === 0}
          aria-label="Previous card"
        >
          ← Prev
        </button>
        <button
          class="wrapped-nav-btn"
          onClick={nextCard}
          disabled={currentCard.value === totalCards.value - 1}
          aria-label="Next card"
        >
          Next →
        </button>
      </div>

      <div class="wrapped-actions">
        <button
          class="wrapped-share-btn"
          onClick={handleShare}
          data-testid="wrapped-share-btn"
        >
          Share Your Journey
        </button>
      </div>
    </div>
  );
}

interface CardData {
  title: string;
  body: ReturnType<typeof import('preact').h>;
}

function buildCards(data: WrappedData): CardData[] {
  const cards: CardData[] = [];

  // Card 1: Total distance hero
  cards.push({
    title: 'The Road Goes Ever On',
    body: (
      <div class="wrapped-stat-hero">
        <div class="wrapped-stat-number">{data.total_distance_km} km</div>
        <p>
          You walked <strong>{data.total_distance_km} km</strong> in {data.year} — that's{' '}
          <strong>{data.journey_pct}%</strong> of the journey to Mordor!
        </p>
      </div>
    ),
  });

  // Card 2: Walk count & active days
  if (data.walk_count > 0) {
    cards.push({
      title: 'Every Step Counts',
      body: (
        <div class="wrapped-stat-grid">
          <div class="wrapped-stat-item">
            <span class="wrapped-stat-value">{data.walk_count}</span>
            <span class="wrapped-stat-label">walks logged</span>
          </div>
          <div class="wrapped-stat-item">
            <span class="wrapped-stat-value">{(data.total_distance_km / data.walk_count).toFixed(1)}</span>
            <span class="wrapped-stat-label">km avg per walk</span>
          </div>
        </div>
      ),
    });
  }

  // Card 3: Best streak
  if (data.best_streak > 1) {
    const streakTitle = data.best_streak >= 90
      ? 'The Will of the Ring-bearer'
      : data.best_streak >= 30
        ? 'The Fellowship\'s Endurance'
        : data.best_streak >= 14
          ? 'The Resolve of a Ranger'
          : data.best_streak >= 5
            ? 'The Determination of a Hobbit'
            : 'A Content Hobbit';
    const streakDesc = data.best_streak >= 90
      ? 'the unbreakable will of Frodo bearing the Ring!'
      : data.best_streak >= 30
        ? 'the tireless endurance of the Fellowship on a long march.'
        : data.best_streak >= 14
          ? 'the steady resolve of a Ranger pacing the wild.'
          : data.best_streak >= 5
            ? 'the hearty determination of a hobbit stepping out their front door.'
            : 'the leisurely pace of a hobbit content to stay in the Shire—and there\'s nothing wrong with that!';

    cards.push({
      title: streakTitle,
      body: (
        <div class="wrapped-stat-hero">
          <div class="wrapped-stat-number">{data.best_streak} days</div>
          <p>
            Your best streak was <strong>{data.best_streak} consecutive days</strong> — {streakDesc}
          </p>
        </div>
      ),
    });
  }

  // Card 4: Favorite month
  if (data.favorite_month) {
    cards.push({
      title: 'Your Strongest Month',
      body: (
        <div class="wrapped-stat-hero">
          <div class="wrapped-stat-number">{data.favorite_month.name}</div>
          <p>
            You covered <strong>{data.favorite_month.total_km} km</strong> in{' '}
            {data.favorite_month.name} — your most active month of the year.
          </p>
        </div>
      ),
    });
  }

  // Card 5: Milestones
  if (data.milestones.length > 0) {
    cards.push({
      title: 'Milestones Unlocked',
      body: (
        <div class="wrapped-milestones">
          <div class="wrapped-milestone-count">{data.milestones.length} milestones</div>
          <ul class="wrapped-milestone-list">
            {data.milestones.map((m: WrappedMilestone) => (
              <li key={m.id} class="wrapped-milestone-item">
                {m.image_id && <WrappedMilestoneImage m={m} />}
                <div class="wrapped-milestone-details">
                  <div class="wrapped-milestone-title">{m.title}</div>
                  <div class="wrapped-milestone-dist">{Math.round(m.distance)} km</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ),
    });
  }

  // Card 6: Fellowship highlights
  if (data.fellowship_highlights.length > 0) {
    cards.push({
      title: 'Fellowship of the Walk',
      body: (
        <div class="wrapped-fellowships">
          <p>The road is easier when shared with friends.</p>
          <ul class="wrapped-fellowship-list">
            {data.fellowship_highlights.map((f) => (
              <li key={f.party_name} class="wrapped-fellowship-item">
                <strong>{f.party_name}</strong> — {f.party_year_km} km together
              </li>
            ))}
          </ul>
        </div>
      ),
    });
  }

  // Card 7: Narrative summary
  cards.push({
    title: 'Your Story',
    body: (
      <div class="wrapped-narrative">
        {data.narrative.split('\n\n').map((paragraph, i) => (
          <p key={i}>{paragraph}</p>
        ))}
      </div>
    ),
  });

  return cards;
}

/**
 * Renders a shareable image card using the Canvas API.
 * Generates a downloadable PNG with key stats and a themed background.
 */
export function renderShareImage(data: WrappedData): void {
  const canvas = document.createElement('canvas');
  canvas.width = 600;
  canvas.height = 400;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const secondaryStat = data.walk_count > 0
    ? `${(data.total_distance_km / data.walk_count).toFixed(1)} km/walk`
    : `${data.active_days} active days`;

  // Background gradient (Parchment theme)
  const gradient = ctx.createLinearGradient(0, 0, 600, 400);
  gradient.addColorStop(0, '#fdf6e3');
  gradient.addColorStop(0.5, '#f4e4bc');
  gradient.addColorStop(1, '#e0c090');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 600, 400);

  // Distressed borders
  ctx.strokeStyle = 'rgba(139, 90, 43, 0.4)';
  ctx.lineWidth = 10;
  ctx.strokeRect(5, 5, 590, 390);

  // Title
  ctx.fillStyle = '#5c4033';
  ctx.font = 'bold 28px serif';
  ctx.textAlign = 'center';
  ctx.fillText(`Walk to Mordor — ${data.year}`, 300, 50);

  // Decorative line
  ctx.strokeStyle = '#8b5a2b';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(100, 65);
  ctx.lineTo(500, 65);
  ctx.stroke();

  // Total distance
  ctx.fillStyle = '#3a2a1a';
  ctx.font = 'bold 48px serif';
  ctx.fillText(`${Math.round(data.total_distance_km)} km`, 300, 130);

  ctx.font = '18px sans-serif';
  ctx.fillStyle = '#5c4033';
  ctx.fillText(`${Math.round(data.journey_pct)}% of the journey to Mordor`, 300, 160);

  // Stats row
  ctx.font = '16px sans-serif';
  ctx.fillStyle = '#5c4033';
  const statsY = 210;
  ctx.fillText(`${data.walk_count} walks`, 150, statsY);
  ctx.fillText(secondaryStat, 300, statsY);
  ctx.fillText(`${data.best_streak}-day streak`, 450, statsY);

  // Milestones
  ctx.font = 'bold 20px serif';
  ctx.fillStyle = '#8b5a2b';
  ctx.fillText(`${data.milestones.length} milestones unlocked`, 300, 270);

  // Fellowship highlights
  if (data.fellowship_highlights.length > 0) {
    ctx.font = '16px sans-serif';
    ctx.fillStyle = '#8b5a2b';
    const fellowshipText = data.fellowship_highlights
      .map((f) => `${f.party_name}: ${Math.round(f.party_year_km)} km`)
      .join(' • ');
    ctx.fillText(fellowshipText, 300, 310);
  }

  // Footer
  ctx.font = '14px sans-serif';
  ctx.fillStyle = '#a08060';
  ctx.fillText('Walk to Mordor', 300, 380);

  // Trigger download
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `walk-to-mordor-${data.year}-wrapped.png`;
    a.click();
    URL.revokeObjectURL(url);
  }, 'image/png');
}
