-- Multilingual Reporting columns
ALTER TABLE issues ADD COLUMN IF NOT EXISTS original_description text;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS reported_language text default 'English';

-- Citizen Reputation System columns
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS civic_points int default 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS badge text default 'Newcomer';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS total_reports int default 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS verified_reports int default 0;