import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lbgiprbhargxpokyecqn.supabase.co';
const supabaseAnonKey = 'sb_publishable_JgPr6q3A1XHyOXiFiAWzDg_IYIQRDEk';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
