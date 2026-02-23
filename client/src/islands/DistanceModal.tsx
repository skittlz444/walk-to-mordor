interface DistanceModalProps {
  selectedDate: string;
  distanceValue: string;
  isEdit: boolean;
}

export function DistanceModal({ selectedDate, distanceValue, isEdit }: DistanceModalProps) {
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
              <input type="number" id="distance-input" step="0.01" min="0" defaultValue={distanceValue} placeholder="0.00" />
              <span class="km-suffix">km</span>
            </div>
            <div class="quick-entry-group">
              <button type="button" class="quick-btn" id="quick-add-1">+1 km</button>
              <button type="button" class="quick-btn" id="quick-add-5">+5 km</button>
              <button type="button" class="quick-btn" id="quick-reset">Reset</button>
            </div>
          </div>
        </div>
        <div class="modal-footer modal-footer-full">
          <div class="modal-footer-btns modal-footer-btns-edit">
            {isEdit ? <button type="button" class="btn btn-danger" id="delete-btn">Delete</button> : null}
            <button type="button" class="btn btn-primary" id="save-btn">{isEdit ? 'Save' : 'Add'}</button>
            <button type="button" class="btn btn-secondary" id="cancel-btn">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}
