-- Add social identity columns to users
ALTER TABLE users ADD COLUMN avatar_id TEXT DEFAULT NULL;
ALTER TABLE users ADD COLUMN friend_code TEXT DEFAULT NULL;

-- Enforce uniqueness for friend_code
CREATE UNIQUE INDEX idx_users_friend_code ON users(friend_code);

-- Create friendships table
CREATE TABLE friendships (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  requester_id INTEGER NOT NULL,
  addressee_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (addressee_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(requester_id, addressee_id),
  CHECK(requester_id != addressee_id),
  CHECK(status IN ('pending', 'accepted'))
);

-- Indexes for friendships
CREATE INDEX idx_friendships_requester ON friendships(requester_id);
CREATE INDEX idx_friendships_addressee ON friendships(addressee_id);
CREATE INDEX idx_friendships_status ON friendships(status);
