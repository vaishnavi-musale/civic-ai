ALTER TABLE issues ADD COLUMN IF NOT EXISTS timeline_steps jsonb DEFAULT '[]';
ALTER TABLE issues ADD COLUMN IF NOT EXISTS resolution_photo_url text;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS resolution_verified_at timestamptz;
