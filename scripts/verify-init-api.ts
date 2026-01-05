
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

// Load env
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
    console.error('Missing env');
    process.exit(1);
}

// Logic similar to route.ts but using admin client to simulate "authenticated" user
// (We cannot easily mock cookies/auth here, so we will use admin client to Insert directly
// to test if the Schema allows insertion with a valid UUID.)

const admin = createClient(supabaseUrl, serviceKey);

async function testInit() {
    console.log('Testing Batch Initialization Logic...');

    // 1. Fetch a real user ID to use (any user)
    const { data: users, error: userError } = await admin.auth.admin.listUsers();
    if (userError || !users.users.length) {
        console.error('Failed to list users or no users found:', userError);
        return;
    }
    const userId = users.users[0].id; // Use first user
    console.log('Using User ID:', userId);

    const batchId = uuidv4();
    const totalCount = 5;

    // 2. Attempt Insert (simulating route.ts logic)
    // Note: route.ts uses RLS (regular client). Admin client Bypasses RLS.
    // If this works, table schema is fine. 
    // If route.ts fails, it MUST be RLS.

    const { error } = await admin.from('batch_jobs').insert({
        id: batchId,
        user_id: userId,
        status: 'running',
        total_count: totalCount,
        completed_count: 0,
        failed_count: 0
    });

    if (error) {
        console.error('Insert Failed:', error);
        console.log('RESULT: SCHEMA_ERROR');
    } else {
        console.log('Insert Sucessful. BatchId:', batchId);
        console.log('RESULT: SCHEMA_OK');

        // Clean up
        await admin.from('batch_jobs').delete().eq('id', batchId);
    }
}

testInit();
