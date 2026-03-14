-- Phase 1: Database Setup for Church Inventory App

-- Create custom types
-- Quality levels are now represented via separate columns rather than an ENUM to allow subdivisions.
CREATE TYPE photo_status AS ENUM ('pending', 'processed');

-- FloorPlans Table
CREATE TABLE "FloorPlans" (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL, -- e.g., 'Upper Level', 'Lower Level'
    image_url TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Rooms Table
CREATE TABLE "Rooms" (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    floor_plan_id UUID NOT NULL REFERENCES "FloorPlans"(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    map_coordinates JSONB, -- stores polygon/rect boundaries
    page_number INTEGER DEFAULT 1 NOT NULL,
    level_name VARCHAR(255),
    building_name VARCHAR(255),
    room_type VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ItemTypes Table (e.g., 'Chair', 'Table')
CREATE TABLE "ItemTypes" (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ItemTypeAttributes Table (e.g., 'Metal', 'Wood', 'Upholstered' for 'Chair')
CREATE TABLE "ItemTypeAttributes" (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    item_type_id UUID NOT NULL REFERENCES "ItemTypes"(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(item_type_id, name)
);

-- InventoryItems Table
CREATE TABLE "InventoryItems" (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    room_id UUID NOT NULL REFERENCES "Rooms"(id) ON DELETE CASCADE,
    photo_url TEXT NOT NULL,
    item_type_id UUID NOT NULL REFERENCES "ItemTypes"(id),
    qty_excellent INTEGER DEFAULT 0 NOT NULL,
    qty_good INTEGER DEFAULT 0 NOT NULL,
    qty_fair INTEGER DEFAULT 0 NOT NULL,
    qty_poor INTEGER DEFAULT 0 NOT NULL,
    attributes TEXT[] DEFAULT '{}', -- store predefined tags selected for this item
    notes TEXT, -- separate free-form notes
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- IncomingPhotos Table
CREATE TABLE "IncomingPhotos" (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    photo_url TEXT NOT NULL,
    uploaded_by VARCHAR(255), -- User ID or Name
    status photo_status DEFAULT 'pending' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE "FloorPlans" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Rooms" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ItemTypes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ItemTypeAttributes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InventoryItems" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "IncomingPhotos" ENABLE ROW LEVEL SECURITY;

-- Basic RLS Policies
-- Adjust policies based on exact authentication requirements in production.
-- These policies allow public reads to enable easy testing from frontend without auth during dev.

CREATE POLICY "Allow public read access" ON "FloorPlans" FOR SELECT TO public USING (true);
CREATE POLICY "Allow public insert access" ON "FloorPlans" FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Allow public update access" ON "FloorPlans" FOR UPDATE TO public USING (true);
CREATE POLICY "Allow public delete access" ON "FloorPlans" FOR DELETE TO public USING (true);

CREATE POLICY "Allow public read access" ON "Rooms" FOR SELECT TO public USING (true);
CREATE POLICY "Allow public insert access" ON "Rooms" FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Allow public update access" ON "Rooms" FOR UPDATE TO public USING (true);
CREATE POLICY "Allow public delete access" ON "Rooms" FOR DELETE TO public USING (true);

CREATE POLICY "Allow public read access" ON "InventoryItems" FOR SELECT TO public USING (true);
CREATE POLICY "Allow public insert access" ON "InventoryItems" FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Allow public update access" ON "InventoryItems" FOR UPDATE TO public USING (true);
CREATE POLICY "Allow public delete access" ON "InventoryItems" FOR DELETE TO public USING (true);

CREATE POLICY "Allow public read access" ON "IncomingPhotos" FOR SELECT TO public USING (true);
CREATE POLICY "Allow public insert access" ON "IncomingPhotos" FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Allow public update access" ON "IncomingPhotos" FOR UPDATE TO public USING (true);
CREATE POLICY "Allow public delete access" ON "IncomingPhotos" FOR DELETE TO public USING (true);

CREATE POLICY "Allow public read access" ON "ItemTypes" FOR SELECT TO public USING (true);
CREATE POLICY "Allow public insert access" ON "ItemTypes" FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Allow public update access" ON "ItemTypes" FOR UPDATE TO public USING (true);
CREATE POLICY "Allow public delete access" ON "ItemTypes" FOR DELETE TO public USING (true);

CREATE POLICY "Allow public read access" ON "ItemTypeAttributes" FOR SELECT TO public USING (true);
CREATE POLICY "Allow public insert access" ON "ItemTypeAttributes" FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Allow public update access" ON "ItemTypeAttributes" FOR UPDATE TO public USING (true);
CREATE POLICY "Allow public delete access" ON "ItemTypeAttributes" FOR DELETE TO public USING (true);
