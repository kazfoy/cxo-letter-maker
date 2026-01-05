
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
    console.error('Missing env');
    process.exit(1);
}

const admin = createClient(supabaseUrl, serviceKey);

async function check() {
    console.log('Checking batch_jobs table with SELECT ID...');
    const { data, error } = await admin.from('batch_jobs').select('id').limit(1);

    if (error) {
        console.error('Select Error:', error);
        if (error.code === 'PGRST205' || error.code === '42P01') {
            console.log('RESULT: TABLE_MISSING_OR_STALE');
        } else {
            console.log('RESULT: OTHER_ERROR');
        }
    } else {
        console.log('Select successful. Data:', data);
        console.log('RESULT: SUCCESS');
    }
}

check();
