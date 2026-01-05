--Migration number: 0009 	 2026-01-05T06:31:00.000Z

-- This migration links existing progress entries to the first user created
-- It will be executed after the first user registers
-- For now, it just ensures the schema is ready
-- The actual linking will happen in the application code when the first user is created
