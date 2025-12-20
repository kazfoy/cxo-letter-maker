/**
 * URL検証ユーティリティ（SSRF対策）
 * 内部ネットワークや不正なURLへのアクセスを防ぐ
 */

/**
 * IPアドレスがプライベートIPまたはローカルIPかどうかをチェック
 * @param ip IPアドレス文字列
 * @returns プライベートIPまたはローカルIPの場合true
 */
function isPrivateOrLocalIP(ip: string): boolean {
  // IPv4アドレスのパターンチェック
  const ipv4Pattern = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const match = ip.match(ipv4Pattern);

  if (!match) {
    // IPv6やその他の形式はここでは許可しない（より厳格な対策）
    if (ip.includes(':')) {
      // IPv6のローカルアドレス
      return ip === '::1' || ip.startsWith('fe80:') || ip.startsWith('fc00:') || ip.startsWith('fd00:');
    }
    return false;
  }

  const octets = [
    parseInt(match[1], 10),
    parseInt(match[2], 10),
    parseInt(match[3], 10),
    parseInt(match[4], 10),
  ];

  // 各オクテットが0-255の範囲内かチェック
  if (octets.some((octet) => octet < 0 || octet > 255)) {
    return true; // 無効なIPは拒否
  }

  // ローカルホスト: 127.0.0.0/8
  if (octets[0] === 127) {
    return true;
  }

  // プライベートネットワーク: 10.0.0.0/8
  if (octets[0] === 10) {
    return true;
  }

  // プライベートネットワーク: 172.16.0.0/12 (172.16.0.0 - 172.31.255.255)
  if (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) {
    return true;
  }

  // プライベートネットワーク: 192.168.0.0/16
  if (octets[0] === 192 && octets[1] === 168) {
    return true;
  }

  // リンクローカル: 169.254.0.0/16
  if (octets[0] === 169 && octets[1] === 254) {
    return true;
  }

  // ブロードキャスト: 255.255.255.255
  if (octets.every((octet) => octet === 255)) {
    return true;
  }

  // ネットワークアドレス: 0.0.0.0/8
  if (octets[0] === 0) {
    return true;
  }

  // マルチキャスト: 224.0.0.0/4 (224.0.0.0 - 239.255.255.255)
  if (octets[0] >= 224 && octets[0] <= 239) {
    return true;
  }

  return false;
}

/**
 * URLが安全かどうかを検証する（SSRF対策）
 * @param urlString 検証するURL文字列
 * @returns 検証結果とエラーメッセージ
 */
export function isValidUrl(urlString: string): { valid: boolean; error?: string } {
  try {
    const url = new URL(urlString);

    // 1. プロトコルチェック: HTTP/HTTPSのみ許可
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return {
        valid: false,
        error: `不正なプロトコルです: ${url.protocol}. HTTP/HTTPSのみ許可されています。`,
      };
    }

    // 2. ホスト名チェック: localhost等を拒否
    const hostname = url.hostname.toLowerCase();
    const localhostPatterns = [
      'localhost',
      'localhost.localdomain',
      '0.0.0.0',
    ];

    if (localhostPatterns.includes(hostname)) {
      return {
        valid: false,
        error: `ローカルホストへのアクセスは許可されていません: ${hostname}`,
      };
    }

    // 3. IPアドレスの場合、プライベートIPをチェック
    // ホスト名がIPアドレス形式かどうかを判定
    const ipv4Pattern = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    const isIPAddress = ipv4Pattern.test(hostname) || hostname.includes(':');

    if (isIPAddress && isPrivateOrLocalIP(hostname)) {
      return {
        valid: false,
        error: `プライベートIPアドレスへのアクセスは許可されていません: ${hostname}`,
      };
    }

    // 4. ホスト名が空でないことを確認
    if (!hostname || hostname.length === 0) {
      return {
        valid: false,
        error: 'ホスト名が空です',
      };
    }

    // 5. ホスト名の長さチェック（異常に長いホスト名を拒否）
    if (hostname.length > 253) {
      return {
        valid: false,
        error: 'ホスト名が長すぎます',
      };
    }

    // 6. ポート番号のチェック（特定のポートへのアクセスを制限することも可能）
    // 例: 管理用ポート（22, 23, 3389等）へのアクセスを制限
    const restrictedPorts = [22, 23, 25, 3389, 5432, 3306, 27017, 6379];
    if (url.port && restrictedPorts.includes(parseInt(url.port, 10))) {
      return {
        valid: false,
        error: `制限されたポートへのアクセス: ${url.port}`,
      };
    }

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: `無効なURL形式です: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Fetchリクエスト用のAbortControllerとタイムアウトを設定
 * @param timeoutMs タイムアウト時間（ミリ秒）
 * @returns AbortController
 */
export function createFetchTimeout(timeoutMs: number = 10000): AbortController {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), timeoutMs);
  return controller;
}

/**
 * レスポンスサイズをチェック
 * @param response Fetchレスポンス
 * @param maxSizeBytes 最大サイズ（バイト）
 * @returns サイズ制限を超えている場合はエラー
 */
export async function checkResponseSize(
  response: Response,
  maxSizeBytes: number = 5 * 1024 * 1024 // デフォルト5MB
): Promise<{ valid: boolean; error?: string }> {
  const contentLength = response.headers.get('content-length');

  if (contentLength) {
    const size = parseInt(contentLength, 10);
    if (size > maxSizeBytes) {
      return {
        valid: false,
        error: `レスポンスサイズが大きすぎます: ${(size / 1024 / 1024).toFixed(2)}MB (制限: ${(maxSizeBytes / 1024 / 1024).toFixed(2)}MB)`,
      };
    }
  }

  return { valid: true };
}

/**
 * 安全なfetchラッパー
 * URL検証、タイムアウト、サイズ制限を統合
 *
 * @param url リクエストURL
 * @param options Fetchオプション
 * @param timeoutMs タイムアウト時間（ミリ秒）
 * @param maxSizeBytes 最大レスポンスサイズ（バイト）
 * @returns Fetchレスポンス
 */
export async function safeFetch(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = 10000,
  maxSizeBytes: number = 5 * 1024 * 1024
): Promise<Response> {
  // 1. URL検証
  const validation = isValidUrl(url);
  if (!validation.valid) {
    throw new Error(`URL検証エラー: ${validation.error}`);
  }

  // 2. タイムアウト設定
  const controller = createFetchTimeout(timeoutMs);
  const fetchOptions: RequestInit = {
    ...options,
    signal: controller.signal,
  };

  // 3. Fetch実行
  let response: Response;
  try {
    response = await fetch(url, fetchOptions);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`リクエストがタイムアウトしました (${timeoutMs}ms)`);
    }
    throw error;
  }

  // 4. レスポンスサイズチェック
  const sizeCheck = await checkResponseSize(response, maxSizeBytes);
  if (!sizeCheck.valid) {
    throw new Error(sizeCheck.error);
  }

  return response;
}
