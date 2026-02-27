-- Migration 0119_create_fellowship_tables.sql
-- Create Fellowship (party) tables for multiplayer features

-- Create parties table for Fellowship feature
-- distance_mode: 'incremental' (default) or 'cumulative' — set at creation, immutable
-- leave_distance_behavior: 'keep' (default) or 'remove' — leader-configurable
-- dissolved_at: set when all members have departed; NULL for active parties
CREATE TABLE IF NOT EXISTS parties (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    name TEXT NOT NULL,
    leader_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    invite_code TEXT UNIQUE NOT NULL,
    distance_mode TEXT NOT NULL DEFAULT 'incremental' CHECK(distance_mode IN ('incremental', 'cumulative')),
    leave_distance_behavior TEXT NOT NULL DEFAULT 'keep' CHECK(leave_distance_behavior IN ('keep', 'remove')),
    dissolved_at DATETIME DEFAULT NULL,
    FOREIGN KEY (leader_id) REFERENCES users (id)
);

-- Indexes for parties table
CREATE INDEX IF NOT EXISTS idx_parties_leader_id ON parties(leader_id);
-- idx_parties_invite_code omitted: the UNIQUE constraint on invite_code already creates an implicit unique index

-- Create party_members table
-- role: 'leader' or 'member'
-- status: 'active', 'left' (voluntary), or 'kicked' (leader-initiated)
-- distance_at_join: user's total distance across all time at moment of joining (required for incremental mode)
-- last_viewed_distance: party's total distance as of user's last view (for milestone modal detection)
-- departed_at: set when status changes to 'left' or 'kicked'; NULL for active members
-- distance_kept: NULL for active members; true/false locked at departure to record contribution disposition
-- contribution_at_departure: NULL for active; computed once at leave/kick time for fast progress reads
-- Re-joins reactivate this row (fresh joined_at, distance_at_join, last_viewed_distance; clear departure fields)
-- UNIQUE(party_id, user_id): one row per party+user pair; no unique constraint on user_id alone (multi-party support)
CREATE TABLE IF NOT EXISTS party_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    party_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    distance_at_join REAL NOT NULL DEFAULT 0,
    role TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('leader', 'member')),
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'left', 'kicked')),
    last_viewed_distance REAL NOT NULL DEFAULT 0,
    departed_at DATETIME DEFAULT NULL,
    distance_kept INTEGER DEFAULT NULL CHECK(distance_kept IS NULL OR distance_kept IN (0, 1)),
    contribution_at_departure REAL DEFAULT NULL,
    UNIQUE(party_id, user_id),
    FOREIGN KEY (party_id) REFERENCES parties (id),
    FOREIGN KEY (user_id) REFERENCES users (id)
);

-- Indexes for party_members table
-- idx_party_members_user_id: fast multi-party lookups for a given user
-- idx_party_members_status: efficient filtering of active members
-- idx_party_members_party_id_status: composite covering index for the dominant query (active members of a party)
--   Note: also covers party_id-only queries, so a standalone idx_party_members_party_id is unnecessary
CREATE INDEX IF NOT EXISTS idx_party_members_user_id ON party_members(user_id);
CREATE INDEX IF NOT EXISTS idx_party_members_status ON party_members(status);
CREATE INDEX IF NOT EXISTS idx_party_members_party_id_status ON party_members(party_id, status);

-- Create party_progress_log table
-- Dual purpose: activity feed display and contribution audit trail
-- date: correlates with the progress table entry date for the walk
-- logged_at: timestamp for ordering the activity feed and auditing
CREATE TABLE IF NOT EXISTS party_progress_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    party_id INTEGER NOT NULL,
    logged_by_user_id INTEGER NOT NULL,
    distance REAL NOT NULL,
    date DATE NOT NULL,
    logged_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(party_id, logged_by_user_id, date),
    FOREIGN KEY (party_id) REFERENCES parties (id),
    FOREIGN KEY (logged_by_user_id) REFERENCES users (id)
);

-- Indexes for party_progress_log table
-- idx_party_progress_log_party_id_logged_at: composite for activity feed (WHERE party_id = ? ORDER BY logged_at DESC)
-- idx_party_progress_log_user_id: fast per-user contribution queries
-- idx_party_progress_log_date: efficient date-range queries
CREATE INDEX IF NOT EXISTS idx_party_progress_log_party_id_logged_at ON party_progress_log(party_id, logged_at);
CREATE INDEX IF NOT EXISTS idx_party_progress_log_user_id ON party_progress_log(logged_by_user_id);
CREATE INDEX IF NOT EXISTS idx_party_progress_log_date ON party_progress_log(date);
