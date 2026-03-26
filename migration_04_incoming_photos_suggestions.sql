ALTER TABLE "IncomingPhotos"
  ADD COLUMN IF NOT EXISTS suggestion_type_name    VARCHAR(255),
  ADD COLUMN IF NOT EXISTS suggestion_attributes   TEXT[]    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS suggestion_quantity     INTEGER   DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS suggestion_quality      VARCHAR(50) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS suggestion_qty_excellent INTEGER  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS suggestion_qty_good      INTEGER  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS suggestion_qty_fair      INTEGER  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS suggestion_qty_poor      INTEGER  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS suggestion_notes         TEXT      DEFAULT NULL;
