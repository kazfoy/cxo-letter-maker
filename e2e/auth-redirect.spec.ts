import { test, expect } from '@playwright/test';

/**
 * E2Eテスト: 認証リダイレクトの検証
 * 
 * このテストは、SupabaseのMagic Link認証におけるリダイレクト動作を検証します。
 * 実際のメール送信は行わず、Callback URLへの直接アクセスをシミュレートします。
 */

test.describe('認証リダイレクトの検証', () => {
  const baseURL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000';

  test('パスワード設定待ちユーザー: next=/setup-password パラメータでリダイレクト', async ({ request }) => {
    // nextパラメータ付きのCallback URLにアクセス
    const callbackUrl = `${baseURL}/auth/callback?next=/setup-password`;
    
    // リダイレクトを追跡しないリクエスト
    const response = await request.get(callbackUrl, { 
      maxRedirects: 0, // リダイレクトを追跡しない
    });
    
    // codeパラメータがない場合、307リダイレクトが返されることを確認
    expect(response.status()).toBe(307);
    
    // Locationヘッダーを確認
    const location = response.headers()['location'];
    expect(location).toBeTruthy();
    expect(location).toContain('/login');
    expect(location).toContain('error=missing_code');
  });

  test('Callback URL: nextパラメータなしでリダイレクト（デフォルト動作）', async ({ request }) => {
    // nextパラメータなしのCallback URLにアクセス
    const callbackUrl = `${baseURL}/auth/callback`;
    
    const response = await request.get(callbackUrl, { 
      maxRedirects: 0,
    });
    
    // codeパラメータがないため、307リダイレクトが返される
    expect(response.status()).toBe(307);
    
    // Locationヘッダーを確認
    const location = response.headers()['location'];
    expect(location).toBeTruthy();
    expect(location).toContain('/login');
  });

  test('Callback URL: リダイレクトレスポンスのステータスコードを検証', async ({ request }) => {
    // サーバーサイドのリダイレクトレスポンスを直接検証
    const testCases = [
      { next: '/setup-password', description: 'next=/setup-password の場合' },
      { next: '/dashboard', description: 'next=/dashboard の場合' },
      { next: null, description: 'nextパラメータなしの場合' },
    ];

    for (const testCase of testCases) {
      const url = testCase.next 
        ? `${baseURL}/auth/callback?next=${testCase.next}`
        : `${baseURL}/auth/callback`;
      
      // リダイレクトを追跡しないリクエスト
      const response = await request.get(url, { 
        maxRedirects: 0, // リダイレクトを追跡しない
      });
      
      // codeパラメータがないため、307リダイレクトが返される
      expect(response.status()).toBe(307);
      
      // Locationヘッダーを確認
      const location = response.headers()['location'];
      expect(location).toBeTruthy();
      
      // /loginにリダイレクトされることを確認
      expect(location).toContain('/login');
    }
  });

  test('setup-passwordページへのアクセス制御を検証', async ({ request }) => {
    // 未認証ユーザーが /setup-password にアクセスした場合
    const response = await request.get(`${baseURL}/setup-password`, { 
      maxRedirects: 0,
    });
    
    // 未認証の場合は307リダイレクトが返されることを確認
    expect(response.status()).toBe(307);
    
    // Locationヘッダーを確認
    const location = response.headers()['location'];
    expect(location).toBeTruthy();
    expect(location).toContain('/login');
  });

  test('ログインページの動作を確認', async ({ request }) => {
    const response = await request.get(`${baseURL}/login`);
    
    // ログインページが正しく返されることを確認
    expect(response.status()).toBe(200);
    
    const body = await response.text();
    expect(body).toContain('ログイン');
    expect(body).toContain('新規登録');
  });
});

/**
 * 統合テスト: リダイレクトフローのシミュレーション
 * 
 * 注意: 実際のSupabase認証を使用するには、有効なcodeパラメータとセッションが必要です。
 * このテストは、リダイレクトロジックの構造を検証するためのものです。
 */
test.describe('リダイレクトフローの統合テスト', () => {
  const baseURL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000';

  test('Callback URLのリダイレクトロジックを検証', async ({ request }) => {
    // テストケース: 様々なnextパラメータの組み合わせ
    const testCases = [
      { next: '/setup-password', description: 'next=/setup-password の場合' },
      { next: '/dashboard', description: 'next=/dashboard の場合' },
      { next: null, description: 'nextパラメータなしの場合' },
    ];

    for (const testCase of testCases) {
      const url = testCase.next 
        ? `${baseURL}/auth/callback?next=${testCase.next}`
        : `${baseURL}/auth/callback`;
      
      const response = await request.get(url, { 
        maxRedirects: 0,
      });
      
      // codeパラメータがないため、307リダイレクトが返される
      expect(response.status()).toBe(307);
      
      // Locationヘッダーを確認
      const location = response.headers()['location'];
      expect(location).toBeTruthy();
      expect(location).toContain('/login');
      
      console.log(`✅ ${testCase.description}: ${location}`);
    }
  });
});

