import { useSignal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import type { Goal } from '../types/goal';

interface GoalModalProps {
  goal: Goal;
  currentDistance: number;
  isCongratulations?: boolean;
  onClose: () => void;
}

export function GoalModal({ goal, currentDistance, isCongratulations = false, onClose }: GoalModalProps) {
  const highResLoaded = useSignal(false);
  const thumbFormat = useSignal<'webp' | 'jpg'>('webp');
  const highResFormat = useSignal<'webp' | 'jpg'>('webp');

  const isCompleted = Number(currentDistance) >= goal.distance;
  const distanceToGo = isCompleted ? 0 : goal.distance - Number(currentDistance);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleOverlayClick = (e: preact.JSX.TargetedEvent<HTMLDivElement, MouseEvent>) => {
    if ((e.target as HTMLElement).classList.contains('modal-overlay')) {
      onClose();
    }
  };

  const handleHighResLoad = () => {
    highResLoaded.value = true;
  };

  const handleThumbError = (e: preact.JSX.TargetedEvent<HTMLImageElement, Event>) => {
    const img = e.target as HTMLImageElement;
    if (thumbFormat.value === 'webp') {
      // Try .jpg format
      thumbFormat.value = 'jpg';
      img.src = `/img/thumbs/${goal.image_id || '0'}-thumb.jpg`;
    } else if (!img.src.includes('/img/thumbs/0-thumb.webp')) {
      // Fallback to placeholder
      img.src = '/img/thumbs/0-thumb.webp';
    }
  };

  const handleHighResError = (e: preact.JSX.TargetedEvent<HTMLImageElement, Event>) => {
    const img = e.target as HTMLImageElement;
    if (highResFormat.value === 'webp') {
      // Try .jpg format
      highResFormat.value = 'jpg';
      img.src = `/img/highres/${goal.image_id || '0'}.jpg`;
    } else if (!img.src.includes('/img/highres/0.webp')) {
      // Fallback to placeholder
      img.src = '/img/highres/0.webp';
    }
  };

  const distanceStyle = isCompleted 
    ? 'text-decoration: line-through; color: #888;' 
    : 'color: #FFD700;';

  return (
    <div class="modal-overlay" onClick={handleOverlayClick}>
      <div class="modal-dialog modal-large">
        <div class="modal-content">
          <div class="modal-body goal-modal-scrollable">
            <div style="padding: 1.5em;">
              {isCongratulations && (
                <div class="goal-congratulations">
                  🎉 Congratulations! You've passed a new goal! 🎉
                </div>
              )}
              
              {goal.special && (
                <div style="color: #FFD700; font-size: 1.4em; font-weight: bold; margin-bottom: 0.5em; text-align: center;">
                  {goal.special}
                </div>
              )}
              
              <div style="color: #fff; font-size: 1.2em; font-weight: bold; margin-bottom: 0.8em; text-align: center;">
                {goal.title}
              </div>
              
              <div style={`${distanceStyle} font-size: 1.1em; margin-bottom: 0.5em; text-align: center;`}>
                {goal.distance.toFixed(2)} km
              </div>
              
              {!isCompleted && (
                <div style="color: #aaa; font-size: 1em; margin-bottom: 1em; text-align: center;">
                  {distanceToGo.toFixed(2)} km to go
                </div>
              )}
              
              <div id="goal-image-container" style="margin-bottom: 1em; text-align: center;">
                <div style="position: relative; max-width: 100%; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 8px rgba(0,0,0,0.3);">
                  <img 
                    id="goal-thumb-image"
                    src={`/img/thumbs/${goal.image_id || '0'}-thumb.webp`}
                    alt="Goal image"
                    style={`width: 100%; height: auto; filter: ${highResLoaded.value ? 'none' : 'blur(2px)'}; transition: filter 0.3s ease;`}
                    onError={handleThumbError}
                  />
                  <img 
                    id="goal-highres-image"
                    src={`/img/highres/${goal.image_id || '0'}.webp`}
                    alt="Goal image"
                    style={`position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; opacity: ${highResLoaded.value ? '1' : '0'}; transition: opacity 0.5s ease;`}
                    onLoad={handleHighResLoad}
                    onError={handleHighResError}
                  />
                </div>
              </div>
              
              {goal.description && (
                <div style="color: #ccc; font-size: 1em; line-height: 1.4; text-align: justify;">
                  {goal.description}
                </div>
              )}
            </div>
          </div>
          
          <div class="modal-footer modal-footer-full">
            <div class="modal-footer-btns modal-footer-btns-goal">
              <button id="close-goal-btn" type="button" class="btn btn-secondary" onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
