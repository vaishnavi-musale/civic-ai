const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL; // Using VITE_ as it was copied from frontend/root
const supabaseKey = process.env.SUPABASE_SERVICE_KEY; // Service key for backend

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;
