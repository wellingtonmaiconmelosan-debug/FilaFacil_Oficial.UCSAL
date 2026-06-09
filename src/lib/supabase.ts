import { createClient } from '@supabase/supabase-js';

const SUPA_URL = 'https://jgxfglqkfmgasutkqhpw.supabase.co';
const SUPA_KEY = 'sb_publishable_S0lYYvxyz6Tl_7GJearCRA_HasYaxP7';

export const supabase = createClient(SUPA_URL, SUPA_KEY);
