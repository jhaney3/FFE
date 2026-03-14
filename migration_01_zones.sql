-- Run this in your Supabase SQL Editor to add the new zone hierarchy properties

ALTER TABLE "Rooms" 
ADD COLUMN page_number INTEGER DEFAULT 1 NOT NULL,
ADD COLUMN level_name VARCHAR(255),
ADD COLUMN building_name VARCHAR(255),
ADD COLUMN room_type VARCHAR(255);
