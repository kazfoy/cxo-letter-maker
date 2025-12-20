import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import SetupPasswordClient from './SetupPasswordClient';

export default async function SetupPasswordPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // サーバーサイドで未認証を遮断
  if (!user) {
    redirect('/login');
  }

  return <SetupPasswordClient user={user} />;
}
