-- Migration number: 0053    2026-01-27T22:45:45.000Z

-- Update image_id for goal: Camp on west shore (Feb. 23). Many birds circle during the day. Late in day Legolas sees eagle. Wait to full dark to leave (8:30 p.m.). Go slowly (Distance: 1255)
UPDATE goals SET image_id = 'west-shore-birds-circle' WHERE distance = 1255 * 1.60934;
