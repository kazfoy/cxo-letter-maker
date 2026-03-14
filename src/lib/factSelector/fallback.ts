import type { SelectedFact } from '@/types/analysis';

/**
 * 業界情報に基づく補助ファクトを生成
 */
export function generateFallbackFacts(
  industry?: string,
  companyName?: string,
): SelectedFact[] {
  const industryStr = industry || '';
  const companyStr = companyName || '';
  const combined = `${industryStr} ${companyStr}`;

  const keywordSets: { keywords: string[]; facts: SelectedFact[] }[] = [
    {
      keywords: ['自治体', '市役所', '県庁', '省', '庁', '公共', '行政', '官公庁', '地方公共団体', '独立行政法人', '公社', '公団'],
      facts: [
        { content: 'デジタル庁「自治体DX推進計画」の第2期（2026〜2028年度）が始動し、ガバメントクラウド移行と窓口BPRの同時推進が求められている', category: 'recentMoves', relevanceScore: 35, reason: '自治体DX第2期の計画開始に伴う業界動向', quoteKey: '自治体DX第2期', topicTags: ['digital_transformation', 'governance'], bridgeReason: '自治体DX第2期の計画始動に関連', confidence: 40, isMidTermPlan: false },
        { content: '総務省「自治体情報セキュリティ対策ガイドライン」改定（2024年10月）により、ゼロトラスト型セキュリティへの移行計画策定が各自治体に求められている', category: 'companyDirection', relevanceScore: 30, reason: '情報セキュリティガイドライン改定への対応要請', quoteKey: 'ゼロトラスト移行', topicTags: ['digital_transformation', 'risk_management'], bridgeReason: '自治体セキュリティ基準の変更に関連', confidence: 40, isMidTermPlan: false },
      ],
    },
    {
      keywords: ['銀行', '証券', '保険', '金融', 'ファイナンス', '信用金庫', 'リース', '信託', 'アセット'],
      facts: [
        { content: '金融庁「金融分野におけるサイバーセキュリティに関するガイドライン」（2024年10月施行）により、サードパーティリスク管理とインシデント対応体制の強化が義務化', category: 'recentMoves', relevanceScore: 35, reason: '金融庁サイバーセキュリティガイドライン施行への対応', quoteKey: 'サイバーセキュリティガイドライン', topicTags: ['risk_management', 'governance'], bridgeReason: '金融機関のセキュリティ義務強化に関連', confidence: 40, isMidTermPlan: false },
        { content: '全銀ネット次期システム移行（2027年稼働予定）に向け、API連携基盤の整備とリアルタイム決済対応が各金融機関の重要度の高い経営課題に', category: 'companyDirection', relevanceScore: 30, reason: '全銀ネット次期システムへの移行準備', quoteKey: '全銀ネット次期システム', topicTags: ['digital_transformation'], bridgeReason: '決済インフラ刷新に関連', confidence: 40, isMidTermPlan: false },
      ],
    },
    {
      keywords: ['製造', 'メーカー', '工業', '工場', '生産', '素材', '部品', '機械', '電機', '化学', '鉄鋼', '自動車'],
      facts: [
        { content: '経産省「製造業DXレポート2024」によると、製造業のデータ活用率は38%にとどまり、特にサプライチェーン可視化への投資が前年比1.5倍に増加', category: 'companyDirection', relevanceScore: 35, reason: '製造業DXレポートに基づく業界投資動向', quoteKey: '製造業DX', topicTags: ['digital_transformation', 'supply_chain'], bridgeReason: '製造業のデータ活用・サプライチェーン可視化に関連', confidence: 40, isMidTermPlan: false },
        { content: 'EU炭素国境調整メカニズム（CBAM）の本格適用（2026年1月）に向け、製品単位のCO2排出量算定と報告体制の構築が輸出製造業において優先的に取り組むべき課題に', category: 'recentMoves', relevanceScore: 30, reason: 'EU CBAM本格適用に向けた対応期限の接近', quoteKey: 'CBAM対応', topicTags: ['sustainability', 'governance'], bridgeReason: '炭素国境調整メカニズムへの対応に関連', confidence: 40, isMidTermPlan: false },
      ],
    },
    {
      keywords: ['スタートアップ', 'ベンチャー', 'SaaS', 'テック', 'IT', 'ソフトウェア', 'アプリ', 'プラットフォーム'],
      facts: [
        { content: 'IPO市場の審査厳格化（2024年東証グロース上場審査の通過率が前年比15%低下）に伴い、内部統制・コンプライアンス体制の早期構築がスタートアップの重要課題に', category: 'recentMoves', relevanceScore: 35, reason: 'IPO審査厳格化に伴うガバナンス需要の高まり', quoteKey: 'IPO審査厳格化', topicTags: ['governance', 'growth_strategy'], bridgeReason: 'スタートアップの上場準備・内部統制に関連', confidence: 40, isMidTermPlan: false },
        { content: '改正電気通信事業法の外部送信規律（2023年6月施行）への対応に加え、EU AI規制法（2025年段階適用開始）を見据えたAIガバナンス体制の整備が成長企業の新たな経営課題に', category: 'companyDirection', relevanceScore: 30, reason: 'AI規制法の段階適用開始を見据えた対応', quoteKey: 'AIガバナンス', topicTags: ['governance', 'digital_transformation'], bridgeReason: 'テック企業の規制対応に関連', confidence: 40, isMidTermPlan: false },
      ],
    },
    {
      keywords: ['航空', 'エアライン', '空港', '運輸', '旅客', 'ANA', 'JAL'],
      facts: [
        { content: '2024年4月の改正航空法施行により、安全管理体制（SMS）の対象拡大と報告義務の強化が求められ、航空各社でバックオフィス業務を含むオペレーション全体の見直しが進んでいる', category: 'recentMoves', relevanceScore: 35, reason: '改正航空法施行に伴う安全管理体制の見直し', quoteKey: '改正航空法2024', topicTags: ['governance', 'risk_management'], bridgeReason: '航空法改正に伴う管理体制強化に関連', confidence: 40, isMidTermPlan: false },
        { content: '訪日外国人旅行者数が2024年に3,687万人（JNTO速報値）を記録し過去最高を更新、インバウンド需要の急回復に伴いバックオフィス業務の効率化が各社の経営テーマに浮上', category: 'companyDirection', relevanceScore: 30, reason: 'インバウンド急回復に伴う業務効率化ニーズ', quoteKey: '訪日旅行者3687万人', topicTags: ['digital_transformation', 'growth_strategy'], bridgeReason: 'インバウンド急増に伴う業務体制整備に関連', confidence: 40, isMidTermPlan: false },
      ],
    },
    {
      keywords: ['物流', '運送', '倉庫', '配送', '宅配', 'ロジスティクス', '貨物'],
      facts: [
        { content: '2024年4月の働き方改革関連法によるドライバーの時間外労働上限規制（年960時間）が施行され、物流業界では配車計画・庫内作業・管理業務の抜本的なプロセス改革が経営課題に', category: 'recentMoves', relevanceScore: 35, reason: '物流2024年問題（時間外労働上限規制）への対応', quoteKey: '物流2024年問題', topicTags: ['hr_organization', 'digital_transformation'], bridgeReason: '物流業界の労働規制対応に関連', confidence: 40, isMidTermPlan: false },
        { content: '経産省・国交省「物流革新に向けた政策パッケージ」（2023年6月閣議決定）に基づき、荷主・物流事業者双方にトラック待機時間の削減と経費精算・請求管理の標準化が要請されている', category: 'companyDirection', relevanceScore: 30, reason: '物流革新政策パッケージに基づく標準化要請', quoteKey: '物流革新政策パッケージ', topicTags: ['supply_chain', 'digital_transformation'], bridgeReason: '物流業務の標準化・デジタル化に関連', confidence: 40, isMidTermPlan: false },
      ],
    },
    {
      keywords: ['建設', 'ゼネコン', '建築', '土木', '施工', '不動産開発'],
      facts: [
        { content: '2024年4月の建設業における時間外労働上限規制の適用開始により、現場管理のデジタル化とBIM/CIM活用による工程短縮が業界全体のテーマになっている', category: 'recentMoves', relevanceScore: 35, reason: '建設業2024年問題（時間外労働上限規制）への対応', quoteKey: '建設業2024年問題', topicTags: ['hr_organization', 'digital_transformation'], bridgeReason: '建設業の労働規制対応とデジタル化に関連', confidence: 40, isMidTermPlan: false },
        { content: 'CCUS（建設キャリアアップシステム）の登録技能者数が2024年12月時点で140万人を超え、国交省はCCUS活用を公共工事の入札条件に段階的に拡大する方針を示している', category: 'companyDirection', relevanceScore: 30, reason: 'CCUS拡大に伴う管理業務の標準化ニーズ', quoteKey: 'CCUS登録140万人', topicTags: ['digital_transformation', 'governance'], bridgeReason: '建設キャリアアップシステム拡大に関連', confidence: 40, isMidTermPlan: false },
      ],
    },
    {
      keywords: ['医療', '病院', 'クリニック', '製薬', 'ヘルスケア', '医薬', '医療法人', '介護'],
      facts: [
        { content: '2024年4月の医師の働き方改革施行（A水準: 年960時間上限）により、病院経営では診療以外の業務効率化とタスクシフトの実行計画が経営層のアジェンダになっている', category: 'recentMoves', relevanceScore: 35, reason: '医師の働き方改革施行に伴う経営効率化', quoteKey: '医師働き方改革2024', topicTags: ['hr_organization', 'governance'], bridgeReason: '医療機関の働き方改革対応に関連', confidence: 40, isMidTermPlan: false },
        { content: '厚労省の電子処方箋管理サービスが2023年1月に運用開始、2025年3月末時点で対応施設数が1万件を超え、医療機関のDX対応が本格化している', category: 'companyDirection', relevanceScore: 30, reason: '電子処方箋普及に伴う医療DXの加速', quoteKey: '電子処方箋1万施設', topicTags: ['digital_transformation', 'governance'], bridgeReason: '医療DXの本格化に関連', confidence: 40, isMidTermPlan: false },
      ],
    },
    {
      keywords: ['小売', 'リテール', '百貨店', 'スーパー', 'ドラッグストア', 'コンビニ', '量販店', 'ホームセンター', '専門店'],
      facts: [
        { content: '2024年10月の最低賃金改定で全国加重平均が1,055円（前年比51円増、過去最大の引き上げ幅）となり、小売業では人件費上昇に対応する店舗運営の効率化が経営課題に', category: 'recentMoves', relevanceScore: 35, reason: '最低賃金引き上げに伴う店舗運営効率化の必要性', quoteKey: '最低賃金1055円', topicTags: ['hr_organization', 'finance_ops'], bridgeReason: '人件費上昇に伴う小売業の経営課題に関連', confidence: 40, isMidTermPlan: false },
        { content: 'インボイス制度（2023年10月開始）の経過措置期間中に、中小小売業者では仕入税額控除の管理と経理業務の負荷が増加し、請求書・経費処理の自動化ニーズが高まっている', category: 'companyDirection', relevanceScore: 30, reason: 'インボイス制度対応に伴う経理業務負荷の増加', quoteKey: 'インボイス経過措置', topicTags: ['finance_ops', 'digital_transformation'], bridgeReason: 'インボイス制度対応に関連', confidence: 40, isMidTermPlan: false },
      ],
    },
  ];

  for (const { keywords, facts } of keywordSets) {
    if (keywords.some((kw) => combined.includes(kw))) {
      return facts;
    }
  }

  // Generic fallback
  return [
    { content: '電子帳簿保存法の電子取引データ保存義務（2024年1月完全義務化済）を受け、請求書・契約書のペーパーレス化と検索要件対応が全業種で加速', category: 'recentMoves', relevanceScore: 30, reason: '電子帳簿保存法完全義務化後の対応動向', quoteKey: '電子帳簿保存法', topicTags: ['digital_transformation', 'governance'], bridgeReason: '法令対応に伴う業務デジタル化に関連', confidence: 38, isMidTermPlan: false },
    { content: '人的資本開示の義務化（上場企業、2023年3月期〜）と「骨太の方針2024」でのリスキリング投資5年1兆円目標を背景に、人材戦略と経営戦略の連動が経営アジェンダに', category: 'companyDirection', relevanceScore: 25, reason: '人的資本開示義務化に伴う経営課題', quoteKey: '人的資本経営', topicTags: ['hr_organization', 'governance'], bridgeReason: '人材戦略の経営課題化に関連', confidence: 38, isMidTermPlan: false },
  ];
}
