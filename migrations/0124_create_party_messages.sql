-- Migration 0124_create_party_messages.sql
-- Create party_messages table for fellowship messaging feature

CREATE TABLE IF NOT EXISTS party_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    party_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (party_id) REFERENCES parties (id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- Index for activity feed queries (party + chronological order)
CREATE INDEX IF NOT EXISTS idx_party_messages_party_id_created_at ON party_messages(party_id, created_at);
-- Index for per-user message queries
CREATE INDEX IF NOT EXISTS idx_party_messages_user_id ON party_messages(user_id);
