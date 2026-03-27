-- Allow rooms to exist without a floor plan (virtual/folder-only rooms)
ALTER TABLE "Rooms" ALTER COLUMN floor_plan_id DROP NOT NULL;

-- Allow items to be created without a triage photo (direct "Add Item" from tree)
ALTER TABLE "InventoryItems" ALTER COLUMN photo_url DROP NOT NULL;
