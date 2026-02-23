import { useState, useCallback } from 'preact/hooks';

export interface DistanceModalProps {
  selectedDate: string;
  distanceValue: string;
  isEdit: boolean;
  onSave?: (distance: number) => void;
  onDelete?: () => void;
  onCancel?: () => void;
}

export function DistanceModal({
  selectedDate,
  distanceValue,
  isEdit,
  onSave,
  onDelete,
  onCancel,
}: DistanceModalProps) {
  const [distance, setDistance] = useState(distanceValue);

  const handleQuickAdd = useCallback(
    (amount: number) => {
      const current = parseFloat(distance) || 0;
      setDistance((current + amount).toFixed(2));
    },
    [distance]
  );

  const handleReset = useCallback(() => {
    setDistance('0.00');
  }, []);

  const handleSave = useCallback(() => {
    const value = parseFloat(distance);
    if (isNaN(value) || value < 0 || distance === '') {
      alert('Please enter a valid distance');
      return;
    }
    onSave?.(value);
  }, [distance, onSave]);

  return (
    <div class="modal-dialog">
      <div class="modal-content">
        <div class="modal-body">
          <div class="form-group">
            <label>Date: {selectedDate}</label>
          </div>
          <div class="form-group">
            <label htmlFor="distance-input">Distance:</label>
            <div class="input-with-suffix">
              <input
                type="number"
                id="distance-input"
                step="0.01"
                min="0"
                value={distance}
                placeholder="0.00"
                onInput={(e) =>
                  setDistance((e.target as HTMLInputElement).value)
                }
              />
              <span class="km-suffix">km</span>
            </div>
            <div class="quick-entry-group">
              <button
                type="button"
                class="quick-btn"
                id="quick-add-1"
                onClick={() => handleQuickAdd(1)}
              >
                +1 km
              </button>
              <button
                type="button"
                class="quick-btn"
                id="quick-add-5"
                onClick={() => handleQuickAdd(5)}
              >
                +5 km
              </button>
              <button
                type="button"
                class="quick-btn"
                id="quick-reset"
                onClick={handleReset}
              >
                Reset
              </button>
            </div>
          </div>
        </div>
        <div class="modal-footer modal-footer-full">
          <div class="modal-footer-btns modal-footer-btns-edit">
            {isEdit ? (
              <button
                type="button"
                class="btn btn-danger"
                id="delete-btn"
                onClick={onDelete}
              >
                Delete
              </button>
            ) : null}
            <button
              type="button"
              class="btn btn-primary"
              id="save-btn"
              onClick={handleSave}
            >
              {isEdit ? 'Save' : 'Add'}
            </button>
            <button
              type="button"
              class="btn btn-secondary"
              id="cancel-btn"
              onClick={onCancel}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
