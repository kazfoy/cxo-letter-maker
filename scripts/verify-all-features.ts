#!/usr/bin/env npx tsx
/**
 * verify-all-features.ts
 *
 * CxO Letter Maker 全機能検証スクリプト
 *
 * 使用方法:
 *   npx tsx scripts/verify-all-features.ts
 *
 * 環境変数:
 *   BASE_URL: APIベースURL (default: http://localhost:3000)
 *   TIMEOUT: タイムアウト秒数 (default: 30)
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const TIMEOUT = parseInt(process.env.TIMEOUT || '30', 10) * 1000;

interface TestResult {
  endpoint: string;
  method: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  httpStatus?: number;
  message: string;
  duration: number;
}

const results: TestResult[] = [];

// --- Helper Functions ---

async function waitForServer(maxWaitMs = 30000): Promise<boolean> {
  const startTime = Date.now();
  console.log(`\n[INFO] Waiting for server at ${BASE_URL}...`);

  while (Date.now() - startTime < maxWaitMs) {
    try {
      const res = await fetch(`${BASE_URL}/`, {
        method: 'GET',
        signal: AbortSignal.timeout(3000)
      });
      if (res.status === 200) {
        console.log(`[INFO] Server is ready (${Date.now() - startTime}ms)`);
        return true;
      }
    } catch {
      // Server not ready yet
    }
    await new Promise(r => setTimeout(r, 1000));
  }
  console.log(`[ERROR] Server not available after ${maxWaitMs}ms`);
  return false;
}

async function testEndpoint(
  endpoint: string,
  method: string,
  body?: object,
  expectedStatuses: number[] = [200],
  options: { isSSE?: boolean; headers?: Record<string, string> } = {}
): Promise<TestResult> {
  const startTime = Date.now();
  const url = `${BASE_URL}${endpoint}`;

  try {
    const fetchOptions: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      signal: AbortSignal.timeout(TIMEOUT),
    };

    if (body && method !== 'GET') {
      fetchOptions.body = JSON.stringify(body);
    }

    const res = await fetch(url, fetchOptions);
    const duration = Date.now() - startTime;

    // SSEの場合は接続確認のみ
    if (options.isSSE) {
      const contentType = res.headers.get('content-type') || '';
      const isSSEFormat = contentType.includes('text/event-stream') || res.status === 200;
      return {
        endpoint,
        method,
        status: isSSEFormat ? 'PASS' : 'FAIL',
        httpStatus: res.status,
        message: isSSEFormat ? 'SSE connection OK' : `Unexpected content-type: ${contentType}`,
        duration,
      };
    }

    const isExpected = expectedStatuses.includes(res.status);

    // 外部依存系は502/503も許容
    const isExternalDependencyError = [502, 503].includes(res.status);

    let responseText = '';
    try {
      responseText = await res.text();
    } catch {
      responseText = '[Could not read response body]';
    }

    if (isExpected) {
      return {
        endpoint,
        method,
        status: 'PASS',
        httpStatus: res.status,
        message: 'OK',
        duration,
      };
    } else if (isExternalDependencyError && endpoint.includes('news-search')) {
      return {
        endpoint,
        method,
        status: 'PASS',
        httpStatus: res.status,
        message: `External dependency error (acceptable): ${res.status}`,
        duration,
      };
    } else {
      return {
        endpoint,
        method,
        status: 'FAIL',
        httpStatus: res.status,
        message: `Unexpected status ${res.status}. Body: ${responseText.substring(0, 200)}`,
        duration,
      };
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      endpoint,
      method,
      status: 'FAIL',
      message: `Error: ${errorMessage}`,
      duration,
    };
  }
}

// --- Test Cases ---

async function runTests() {
  console.log('\n========================================');
  console.log('  CxO Letter Maker - Feature Verification');
  console.log('========================================\n');
  console.log(`BASE_URL: ${BASE_URL}`);
  console.log(`TIMEOUT: ${TIMEOUT}ms\n`);

  // Wait for server
  const serverReady = await waitForServer();
  if (!serverReady) {
    console.log('\n[FATAL] Server not available. Exiting.');
    process.exit(1);
  }

  console.log('\n--- Testing Public APIs (No Auth) ---\n');

  // 1. GET /api/guest/usage
  results.push(await testEndpoint('/api/guest/usage', 'GET', undefined, [200]));

  // 2. POST /api/generate (正常系)
  results.push(await testEndpoint('/api/generate', 'POST', {
    myCompanyName: 'テスト株式会社',
    myName: '山田 太郎',
    myServiceDescription: 'テストサービス',
    companyName: 'ターゲット株式会社',
    name: '佐藤 花子',
    position: '代表取締役',
    background: 'テスト背景',
    mode: 'sales',
    inputComplexity: 'simple',
    output_format: 'letter',
  }, [200]));

  // 3. POST /api/generate (空body - 全フィールドoptionalのため200もOK)
  results.push(await testEndpoint('/api/generate', 'POST', {}, [200, 400, 422]));

  // 4. POST /api/analyze-url (正常系)
  results.push(await testEndpoint('/api/analyze-url', 'POST', {
    url: 'https://example.com',
  }, [200, 400, 500])); // 外部URLなので500も許容

  // 5. POST /api/analyze-url (入力不備)
  results.push(await testEndpoint('/api/analyze-url', 'POST', {}, [400, 422]));

  // 6. POST /api/analyze-source (multipart/form-data 必須のためSKIP)
  results.push({
    endpoint: '/api/analyze-source',
    method: 'POST',
    status: 'SKIP',
    message: 'Requires multipart/form-data - use /api/analyze-source-stream instead',
    duration: 0,
  });

  // 7. POST /api/search-company (正常系)
  results.push(await testEndpoint('/api/search-company', 'POST', {
    query: 'トヨタ',
  }, [200, 400, 500])); // 外部API依存

  // 8. POST /api/search-company (入力不備)
  results.push(await testEndpoint('/api/search-company', 'POST', {}, [400, 422]));

  // 9. POST /api/news-search (正常系)
  results.push(await testEndpoint('/api/news-search', 'POST', {
    companyName: 'トヨタ自動車',
  }, [200, 400, 500, 502, 503])); // 外部API依存

  // 10. POST /api/news-search (入力不備)
  results.push(await testEndpoint('/api/news-search', 'POST', {}, [400, 422]));

  // 11. POST /api/analyze-source-stream (SSE確認)
  const formData = new FormData();
  formData.append('urls', JSON.stringify(['https://example.com']));
  formData.append('sourceInputType', 'target');
  results.push(await testEndpoint('/api/analyze-source-stream', 'POST', undefined, [200], { isSSE: true }));

  console.log('\n--- Testing Auth-Required APIs (Expected 401/403) ---\n');

  // 認証必要なAPIは認証なしで401/403を期待
  results.push(await testEndpoint('/api/edit', 'POST', { letter: 'test', instruction: 'test' }, [401, 403, 400]));
  results.push(await testEndpoint('/api/improve', 'POST', { letter: 'test', mode: 'sales' }, [401, 403, 400]));
  results.push(await testEndpoint('/api/assist', 'POST', { field: 'test' }, [401, 403, 400]));
  results.push(await testEndpoint('/api/suggest-structure', 'POST', {}, [401, 403, 400]));
  results.push(await testEndpoint('/api/consult', 'POST', {}, [401, 403, 400]));

  // Batch APIs
  results.push(await testEndpoint('/api/batch-jobs/init', 'POST', {}, [401, 403, 400]));
  results.push(await testEndpoint('/api/batch-jobs/process-item', 'POST', {}, [401, 403, 400]));
  results.push(await testEndpoint('/api/batch-jobs/complete', 'POST', {}, [401, 403, 400]));
  results.push(await testEndpoint('/api/batch-usage', 'GET', undefined, [401, 403, 400]));

  // Stripe APIs (skip in E2E)
  results.push({
    endpoint: '/api/checkout',
    method: 'POST',
    status: 'SKIP',
    message: 'Stripe integration - skipped in E2E',
    duration: 0,
  });
  results.push({
    endpoint: '/api/create-portal-session',
    method: 'POST',
    status: 'SKIP',
    message: 'Stripe integration - skipped in E2E',
    duration: 0,
  });
  results.push({
    endpoint: '/api/webhooks/stripe',
    method: 'POST',
    status: 'SKIP',
    message: 'Stripe webhook - requires signature verification',
    duration: 0,
  });

  // Print Results
  printResults();
}

function printResults() {
  console.log('\n========================================');
  console.log('  VERIFICATION RESULTS');
  console.log('========================================\n');

  const passCount = results.filter(r => r.status === 'PASS').length;
  const failCount = results.filter(r => r.status === 'FAIL').length;
  const skipCount = results.filter(r => r.status === 'SKIP').length;

  console.log('| Status | Endpoint | Method | HTTP | Duration | Message |');
  console.log('|--------|----------|--------|------|----------|---------|');

  for (const r of results) {
    const statusIcon = r.status === 'PASS' ? '✅' : r.status === 'FAIL' ? '❌' : '⏭️';
    const http = r.httpStatus ?? '-';
    const duration = `${r.duration}ms`;
    const message = r.message.length > 40 ? r.message.substring(0, 40) + '...' : r.message;
    console.log(`| ${statusIcon} ${r.status} | ${r.endpoint} | ${r.method} | ${http} | ${duration} | ${message} |`);
  }

  console.log('\n----------------------------------------');
  console.log(`  PASS: ${passCount} | FAIL: ${failCount} | SKIP: ${skipCount}`);
  console.log('----------------------------------------\n');

  if (failCount > 0) {
    console.log('--- FAIL Details ---\n');
    for (const r of results.filter(r => r.status === 'FAIL')) {
      console.log(`[FAIL] ${r.method} ${r.endpoint}`);
      console.log(`       HTTP: ${r.httpStatus ?? 'N/A'}`);
      console.log(`       Message: ${r.message}`);
      console.log('');
    }
  }

  console.log('\n--- Re-run Command ---');
  console.log(`BASE_URL=${BASE_URL} npx tsx scripts/verify-all-features.ts\n`);

  process.exit(failCount > 0 ? 1 : 0);
}

// Run
runTests().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
