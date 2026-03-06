-- Create admin audit log table for tracking all admin actions
CREATE TABLE admin_audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_user_id INTEGER NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id INTEGER,
  details TEXT,
  ip_address TEXT,
  success INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_user_id) REFERENCES users(id)
);
CREATE INDEX idx_admin_audit_admin_user ON admin_audit_log(admin_user_id);
CREATE INDEX idx_admin_audit_created ON admin_audit_log(created_at);
