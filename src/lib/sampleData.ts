/**
 * サンプル体験用のデータ定数
 */

/**
 * サンプルの種類（実在企業のみ）
 */
export type SampleType = 'real';

/**
 * サンプルリクエスト判定用の送信者企業名リスト
 * サーバーサイドでクライアントの is_sample フラグを検証するために使用
 */
export const SAMPLE_SENDER_COMPANIES = [
  '株式会社ネクサスソリューションズ',
  '一般社団法人 日本DX推進協会',
] as const;

/**
 * 実在企業サンプル（URL起点のファクト抽出を体験）
 */
export const SAMPLE_DATA = {
  // 自社情報
  myCompanyName: '株式会社ネクサスソリューションズ',
  myName: '橋本 洋生',
  myServiceDescription: 'バックオフィス業務の申請・承認・証憑管理を標準化し、内部統制とガバナンスを強化します。運用負荷を抑えながら、業務の見える化と意思決定のスピード向上を支援します。',

  // ターゲット情報（実在企業）
  companyName: 'トヨタ自動車株式会社',
  department: '経営企画室',
  position: 'ご担当者',
  name: '田中様',
  targetUrl: 'https://global.toyota/jp/',

  // 手紙構成要素
  background: '御社のコーポレートサイトを拝見し、グローバル規模での経営管理体制の高度化に注力されていることを存じ上げました。一般的に、グループ経営においては内部統制の可視化と意思決定スピードの両立が検討テーマになりやすい傾向があります。',

  problem: '一般的に、大企業においては「グループ会社間での申請・承認フローが統一されておらず、監査対応に時間がかかる」「紙ベースの証憑管理が残っており、リモート環境での業務効率が課題になる」といったケースがあると伺います。',

  solution: '弊社のバックオフィス管理プラットフォームは、申請・承認・証憑管理を一元化し、グループ全体での内部統制標準化を目指すことが可能です。状況によっては、監査対応工数の削減やリアルタイムでの業務進捗可視化につながる可能性があります。',

  caseStudy: '一般的に、バックオフィス業務のデジタル化においては、監査準備工数の削減や承認リードタイムの短縮が検討テーマになりやすい傾向があります。グループ経営を推進される企業様では、統制の可視化による経営判断の迅速化も論点になることが多いようです。',

  offer: 'もし差し支えなければ、15分ほどお時間をいただき、御社の現状についてお聞かせいただけますと幸いです。ご都合のよい日程を2〜3候補いただけますでしょうか。',

  // まとめて入力用（セールスモード）
  freeformInput: `対象URL: https://global.toyota/jp/

【背景】
御社のコーポレートサイトを拝見し、グローバル経営管理体制の高度化に注力されていることを存じ上げました。一般的に、グループ経営においては内部統制の可視化と意思決定スピードの両立が検討テーマになりやすい傾向があります。

【課題】
一般的に、大企業においては「グループ会社間での申請・承認フローが統一されておらず、監査対応に時間がかかる」「紙ベースの証憑管理が残っており、リモート環境での効率が課題になる」といったケースがあると伺います。

【解決策】
弊社プラットフォームは申請・承認・証憑管理を一元化し、グループ全体での内部統制標準化を目指すことが可能です。状況によっては、監査対応工数削減やリアルタイムでの業務進捗可視化につながる可能性があります。

【実績】
一般的に、バックオフィス業務のデジタル化においては監査準備工数削減や承認リードタイム短縮が検討テーマになりやすい傾向があります。グループ経営企業様では統制可視化による経営判断の迅速化も論点になることが多いようです。

【お願い】
もし差し支えなければ、15分ほどお時間をいただき、御社の現状についてお聞かせください。ご都合のよい日程を2〜3候補いただけますでしょうか。`,
};


/**
 * イベント招待用サンプルデータ
 * トヨタ自動車を対象企業として使用
 */
export const SAMPLE_EVENT_DATA = {
  // 自社情報
  myCompanyName: '一般社団法人 日本DX推進協会',
  myName: 'イベント企画部 鈴木花子',
  myServiceDescription: '企業のデジタルトランスフォーメーション推進を支援する業界団体。年4回の大規模カンファレンス、月次勉強会を主催。',

  // ターゲット情報（トヨタ自動車）
  companyName: 'トヨタ自動車株式会社',
  department: '経営企画室',
  position: 'ご担当者',
  name: '田中様',
  targetUrl: 'https://global.toyota/jp/',

  // イベント情報（内蔵サンプル - eventUrlは空で自動解析を走らせない）
  eventUrl: '',
  eventName: '製造業向け 間接業務DXとガバナンス強化セミナー',
  eventDateTime: '2026年3月20日（金）13:00-15:00 / オンライン',
  eventSpeakers: '製造業の経営企画責任者 / 内部監査責任者（予定）',
  invitationReason: 'グループ会社を跨ぐ申請・承認・証憑のばらつきを整理し、統制とスピードの両立を議論いただきたく、ご招待申し上げます。当日はグループ統制と証憑管理、承認プロセス標準化、監査工数の削減、運用定着をテーマにディスカッションを予定しております。',
};

/**
 * サンプル会社候補（業界分散）
 */
export const SAMPLE_COMPANY_CANDIDATES = [
  { companyName: '楽天グループ株式会社', targetUrl: 'https://corp.rakuten.co.jp/', industryLabel: 'internet' },
  { companyName: '株式会社ファーストリテイリング', targetUrl: 'https://www.fastretailing.com/jp/', industryLabel: 'retail_apparel' },
  { companyName: '味の素株式会社', targetUrl: 'https://www.ajinomoto.co.jp/', industryLabel: 'food_manufacturing' },
  { companyName: '株式会社MonotaRO', targetUrl: 'https://corp.monotaro.com/', industryLabel: 'b2b_ec' },
  { companyName: '株式会社サイバーエージェント', targetUrl: 'https://www.cyberagent.co.jp/', industryLabel: 'it_media_ads' },
  { companyName: '日本航空株式会社', targetUrl: 'https://www.jal.co.jp/jp/ja/', industryLabel: 'airline' },
] as const;

/**
 * 連続して同じ会社が選ばれるのを防ぐためのキャッシュ
 */
let lastSampleCompanyName: string | null = null;

/**
 * サンプル会社をランダムに取得
 * 連続して同じ会社が選ばれにくいよう、直前の会社を避けるリトライを行う
 */
export function getRandomSampleCompany() {
  const maxRetries = 2;
  let selected = SAMPLE_COMPANY_CANDIDATES[Math.floor(Math.random() * SAMPLE_COMPANY_CANDIDATES.length)];
  for (let i = 0; i < maxRetries && selected.companyName === lastSampleCompanyName; i++) {
    selected = SAMPLE_COMPANY_CANDIDATES[Math.floor(Math.random() * SAMPLE_COMPANY_CANDIDATES.length)];
  }
  lastSampleCompanyName = selected.companyName;
  return selected;
}
