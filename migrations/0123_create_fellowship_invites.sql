-- Create fellowship_invites table for friend-based party invitations
CREATE TABLE fellowship_invites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  party_id INTEGER NOT NULL,
  inviter_id INTEGER NOT NULL,
  invitee_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (party_id) REFERENCES parties(id) ON DELETE CASCADE,
  FOREIGN KEY (inviter_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (invitee_id) REFERENCES users(id) ON DELETE CASCADE,
  CHECK(status IN ('pending', 'accepted', 'rejected'))
);

-- Partial unique index: prevent duplicate PENDING invites only.
-- Rejected rows must NOT block future re-invites for the same (party, invitee).
CREATE UNIQUE INDEX idx_fellowship_invites_pending
  ON fellowship_invites(party_id, invitee_id) WHERE status = 'pending';

-- Index for invitee-focused badge/list queries (pending incoming invites)
CREATE INDEX idx_fellowship_invites_invitee
  ON fellowship_invites(invitee_id, status);

-- Index for party-focused cleanup queries (dissolution invalidation)
CREATE INDEX idx_fellowship_invites_party
  ON fellowship_invites(party_id, status);
