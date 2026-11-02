-- Migration 0147_create_user_achievement_acknowledgements.sql
-- Per-user acknowledgement projection over earned achievement instances. One row
-- per user per instance; pending awards are earned instances minus these rows.
-- Acknowledgements are idempotent and never create, update, or delete
-- user_achievement_instances rows -- that table stays append-only.

CREATE TABLE IF NOT EXISTS user_achievement_acknowledgements (
    user_id INTEGER NOT NULL,
    instance_id INTEGER NOT NULL,
    acknowledged_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, instance_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (instance_id) REFERENCES user_achievement_instances(id) ON DELETE CASCADE
);
