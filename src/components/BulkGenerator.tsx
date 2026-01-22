'use client';

import React, { useState } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { Upload, Check, Play, Loader2, AlertCircle, ChevronDown, ChevronUp, FileSpreadsheet, Download, HelpCircle, Wand2, RefreshCw, CheckCircle2, ArrowRight, RotateCcw, Eye, Shuffle } from 'lucide-react';
import { useUserPlan } from '@/hooks/useUserPlan';
import { getProfile } from '@/lib/profileUtils';
import { ProFeatureModal } from './ProFeatureModal';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { v4 as uuidv4 } from 'uuid';
import { CTA_OPTIONS, type CtaType } from '@/lib/constants';
import type { AnalysisResult, InformationSource } from '@/types/analysis';
import { SourcesDisplay } from './SourcesDisplay';
import { normalizeLetterText } from '@/lib/textNormalize';

/**
 * APIレスポンスの参照揺れを吸収
 * result.sources または result.analysis?.sources のどちらでも対応
 */
function normalizeSources(
    result: AnalysisResult | { analysis?: AnalysisResult } | null | undefined
): InformationSource[] | undefined {
    if (!result) return undefined;

    // 直接 sources を持つ場合 (AnalysisResult)
    if ('sources' in result && result.sources) {
        return result.sources;
    }

    // analysis プロパティを持つ場合
    if ('analysis' in result && result.analysis?.sources) {
        return result.analysis.sources;
    }

    return undefined;
}

type Step = 'upload' | 'mapping' | 'preview' | 'execution';
type MediaType = 'letter' | 'mail';
type GenerationMode = 'sales' | 'event';
type SenderRule = 'default' | 'direct' | 'csv_priority' | 'overwrite';

interface AnalyzedRow {
    [key: string]: string;
}

interface MappingConfig {
    companyName: string;
    name: string;
    position: string;
    background: string;
    note: string;
    url: string;
    eventName: string;
    proposal: string;
    senderName: string;
    senderCompany: string;
    senderDepartment: string;
    senderPosition: string;
    recipientDepartment: string;
    lastName: string;
    firstName: string;
}

const ALIASES = {
    companyName: ['会社名', '企業名', 'Company', '法人名', 'company'],
    name: ['氏名', '名前', '担当者名', 'Name', 'Full Name', 'name'],
    position: ['役職', '肩書き', 'Position', 'Title', 'position'],
    background: ['背景', '目的', 'Background', 'Context', 'background'],
    note: ['備考', 'Note', 'Memo', 'note'],
    url: ['URL', 'Webサイト', 'ホームページ', 'Website', 'url'],
    eventName: ['イベント名', 'Event Name', 'Event', 'event_name'],
    proposal: ['提案内容', 'Proposal', 'Topic', 'proposal', '件名'],
    senderName: ['差出人名', 'Sender Name', 'sender_name', 'From Name'],
    senderCompany: ['差出人会社名', 'Sender Company', 'sender_company', 'From Company'],
    senderPosition: ['差出人役職', 'Sender Position', 'sender_position', 'From Position'],
    senderDepartment: ['差出人部署', 'Sender Dept', 'sender_dept', 'From Dept'],
    recipientDepartment: ['部署', '部署名', 'Department', 'Dept'],
    lastName: ['姓', 'Last Name', 'Surname'],
    firstName: ['名', 'First Name', 'Given Name']
};

interface GenerationStatus {
    index: number;
    status: 'pending' | 'generating' | 'completed' | 'error';
    content?: string;
    error?: string;
}

// Batch Progress Modal Component
const BatchProgressModal = ({
    isOpen,
    progress,
    total,
    currentCompany,
    batchId,
    onFinish,
    statistics
}: {
    isOpen: boolean;
    progress: number;
    total: number;
    currentCompany: string;
    batchId: string;
    onFinish: (action: 'history' | 'stay') => void;
    statistics: { success: number; failure: number };
}) => {
    if (!isOpen) return null;

    const percentage = total > 0 ? Math.round((progress / total) * 100) : 0;
    const isCompleted = total > 0 && progress === total;

    return (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        {isCompleted ? (
                            <>
                                <CheckCircle2 className="w-5 h-5 text-green-500" />
                                生成完了
                            </>
                        ) : (
                            <>
                                <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                                一括生成を実行中...
                            </>
                        )}
                    </h3>
                    {!isCompleted && (
                        <span className="text-xs font-mono bg-white border border-slate-200 px-2 py-1 rounded text-slate-500">
                            {progress} / {total}
                        </span>
                    )}
                </div>

                {/* Body */}
                <div className="p-6">
                    {/* Progress Bar */}
                    <div className="mb-6">
                        <div className="flex justify-between text-sm mb-2">
                            <span className="font-semibold text-slate-700">{percentage}% 完了</span>
                            <span className="text-slate-500">{isCompleted ? 'すべて完了しました' : '画面を閉じないでください'}</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                            <div
                                className="h-full transition-all duration-300 ease-out bg-blue-600"
                                style={{ width: `${percentage}%` }}
                            />
                        </div>
                    </div>

                    {/* Current Action Display */}
                    {!isCompleted && (
                        <div className="bg-slate-50 rounded-xl p-4 mb-6 border border-slate-100">
                            <p className="text-xs text-slate-500 mb-1 uppercase tracking-wider font-semibold">Current Processing</p>
                            <div className="font-bold text-slate-800 text-lg sm:text-xl truncate">
                                {currentCompany || '準備中...'}
                            </div>
                            <p className="text-sm text-slate-500 mt-1">様向けのレターを作成しています</p>
                        </div>
                    )}

                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="bg-green-50 border border-green-100 p-3 rounded-lg text-center">
                            <div className="text-xs text-green-700 font-bold uppercase mb-1">Success</div>
                            <div className="text-2xl font-bold text-green-700">{statistics.success}</div>
                        </div>
                        <div className="bg-red-50 border border-red-100 p-3 rounded-lg text-center">
                            <div className="text-xs text-red-700 font-bold uppercase mb-1">Failed</div>
                            <div className="text-2xl font-bold text-red-700">{statistics.failure}</div>
                        </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="flex gap-3 mt-2">
                        {isCompleted ? (
                            <>
                                <button
                                    onClick={() => onFinish('stay')}
                                    className="flex-1 px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium transition-colors"
                                >
                                    閉じる
                                </button>
                                <button
                                    onClick={() => onFinish('history')}
                                    className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-bold shadow-sm transition-colors flex items-center justify-center gap-2"
                                >
                                    履歴を確認する
                                    <ArrowRight className="w-4 h-4" />
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={() => {
                                    // 新しいタブで履歴ページを開く（生成は継続）
                                    if (batchId) {
                                        window.open(`/dashboard/history/batch/${batchId}`, '_blank');
                                    }
                                }}
                                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium flex items-center justify-center gap-2"
                            >
                                履歴を見る（新しいタブ）
                                <ArrowRight className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

// Success Modal Component (Legacy - kept if needed but BatchProgressModal generally replaces it)
const _SuccessModal = ({
    batchId,
    onClose: _onClose,
    onReset
}: {
    batchId: string;
    onClose: () => void;
    onReset: () => void;
}) => {
    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-200">
                <div className="flex flex-col items-center text-center">
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
                        <CheckCircle2 className="w-6 h-6 text-green-600" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 mb-2">生成を開始しました</h3>
                    <p className="text-slate-600 mb-6">
                        バックグラウンドで処理を実行中です。<br />
                        完了するまでしばらくお待ちください。
                    </p>

                    <div className="flex flex-col gap-3 w-full">
                        <Link
                            href={`/dashboard/history/batch/${batchId}?highlight=true`}
                            className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-semibold"
                        >
                            履歴で進捗を見る
                            <ArrowRight className="w-4 h-4" />
                        </Link>
                        <button
                            onClick={onReset}
                            className="flex items-center justify-center gap-2 w-full px-4 py-2 text-slate-600 hover:bg-slate-50 rounded-lg transition-colors font-medium"
                        >
                            <RotateCcw className="w-4 h-4" />
                            続けて生成する
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export function BulkGenerator() {
    const router = useRouter();
    const { isPro, isPremium } = useUserPlan();
    const [showProModal, setShowProModal] = useState(false);

    const checkProAccess = (e?: React.MouseEvent | React.ChangeEvent) => {
        if (!isPro && !isPremium) {
            e?.preventDefault();
            setShowProModal(true);
            return false;
        }
        return true;
    };

    const [step, setStep] = useState<Step>('upload');
    const [csvData, setCsvData] = useState<AnalyzedRow[]>([]);
    const [headers, setHeaders] = useState<string[]>([]);
    const [isGuideOpen, setIsGuideOpen] = useState(true);

    const handleDownloadTemplate = () => {
        if (!checkProAccess()) return;

        // UTF-8 BOM for Excel compatibility
        const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
        const headers = ['会社名', '氏名', '役職', '提案内容', '背景', '備考', 'URL'];
        const exampleRow = ['株式会社サンプル', '山田 太郎', '代表取締役', '業務効率化ツールの導入について', '貴社のDX推進インタビューを拝見し...', '紹介経由', 'https://example.com'];

        const csvContent = [headers.join(','), exampleRow.join(',')].join('\n');
        const blob = new Blob([bom, csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'cxo_letter_template.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const [senderInfo, setSenderInfo] = useState<{
        myCompanyName: string;
        myDepartment?: string;
        myName: string;
        myPosition: string;
        myServiceDescription: string;
    }>({
        myCompanyName: '',
        myDepartment: '',
        myName: '',
        myPosition: '',
        myServiceDescription: ''
    });

    // New State for Modes
    const [mediaType, setMediaType] = useState<MediaType>('letter');
    const [generationMode, setGenerationMode] = useState<GenerationMode>('sales');
    const [senderRule, setSenderRule] = useState<SenderRule>('default');
    const [nameMode, setNameMode] = useState<'full' | 'separate'>('full');
    const [aiUrl, setAiUrl] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    // AI URL Analysis Handler
    const handleUrlAnalysis = async () => {
        if (!aiUrl) return;
        setIsAnalyzing(true);
        try {
            const response = await fetch('/api/analyze-url', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: aiUrl, type: 'own' }),
            });

            const data = await response.json();

            if (!response.ok) {
                // APIからのエラーメッセージを表示
                const errorMsg = data.error || 'URLの分析に失敗しました。';
                console.error('URL analysis error:', errorMsg, data);
                alert(errorMsg);
                return;
            }

            setSenderInfo(prev => ({
                ...prev,
                myCompanyName: data.companyName || prev.myCompanyName,
                myServiceDescription: data.description || data.summary || prev.myServiceDescription,
                myName: data.personName || prev.myName,
            }));
        } catch (error) {
            console.error('URL analysis error:', error);
            alert('URLの分析に失敗しました。ネットワーク接続を確認してください。');
        } finally {
            setIsAnalyzing(false);
        }
    };
    // Auto-fill profile on mount
    React.useEffect(() => {
        getProfile().then(profile => {
            if (profile) {
                setSenderInfo(prev => ({
                    ...prev,
                    myCompanyName: profile.company_name || '',
                    myName: profile.user_name || '',
                    myServiceDescription: profile.service_description || '',
                    myDepartment: profile.department || '',
                    myPosition: profile.position || ''
                }));
            }
        });
    }, []);

    // 生成オプション設定


    const [mapping, setMapping] = useState<MappingConfig>({
        companyName: '',
        name: '',
        position: '',
        background: '',
        note: '',
        url: '',
        eventName: '',
        proposal: '',
        senderName: '',
        senderCompany: '',
        senderPosition: '',
        senderDepartment: '',
        recipientDepartment: '',
        lastName: '',
        firstName: ''
    });

    const [isGenerating, setIsGenerating] = useState(false);
    const [_isCancelling, setIsCancelling] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [currentCompany, setCurrentCompany] = useState('');
    const pausedRef = React.useRef(false); // Ref for immediate pause control in loop

    // Phase 5: Preview state
    const [previewItems, setPreviewItems] = useState<Array<{
        index: number;
        row: AnalyzedRow;
        content?: string;
        status: 'pending' | 'generating' | 'completed' | 'error';
        error?: string;
        sources?: InformationSource[];
    }>>([]);
    const [isPreviewGenerating, setIsPreviewGenerating] = useState(false);
    const [ctaType, setCtaType] = useState<CtaType>('schedule_url');
    const [_isPreviewApproved, setIsPreviewApproved] = useState(false);

    const [currentBatchId, setCurrentBatchId] = useState<string | null>(null);
    const [progress, setProgress] = useState({ current: 0, total: 0 });
    const [results, setResults] = useState<GenerationStatus[]>([]);
    const [statistics, setStatistics] = useState({ successCount: 0, failureCount: 0 });
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [usageInfo, setUsageInfo] = useState<{
        usedToday: number;
        dailyLimit: number;
        remaining: number;
        userPlan: string;
    } | null>(null);
    const [_showSuccessModal, setShowSuccessModal] = useState(false);

    // Toggle Pause (kept for potential future use)
    const _handleTogglePause = () => {
        const nextState = !isPaused;
        setIsPaused(nextState);
        pausedRef.current = nextState;
    };

    // Cancel Process (Stops loop, kept for potential future use)
    const _handleCancelProcess = async () => {
        setIsCancelling(true);
        // Note: The loop checks isCancelling state (or we can use a ref if needed, but state update usually triggers re-render 
        cancelRef.current = true; // Set ref to true for immediate exit
    };
    const cancelRef = React.useRef(false);

    // V2フロー用のヘルパー関数
    const generateWithV2Flow = async (params: {
        targetUrl?: string;
        companyName: string;
        personName: string;
        position?: string;
        background?: string;
        note?: string;
        senderCompany: string;
        senderDepartment?: string;
        senderName: string;
        senderService: string;
        outputFormat: 'letter' | 'email';
    }): Promise<{ success: boolean; content?: string; error?: string; sources?: InformationSource[] }> => {
        try {
            // Step 1: analyze-input API
            const userNotes = [
                params.companyName && `企業名: ${params.companyName}`,
                params.personName && `担当者: ${params.personName}`,
                params.position && `役職: ${params.position}`,
                params.background && `背景・経緯: ${params.background}`,
                params.note && `追加情報: ${params.note}`,
            ].filter(Boolean).join('\n');

            const analysisRes = await fetch('/api/analyze-input', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    target_url: params.targetUrl || undefined,
                    user_notes: userNotes || undefined,
                    sender_info: {
                        company_name: params.senderCompany,
                        service_description: params.senderService,
                    },
                }),
            });

            if (!analysisRes.ok) {
                const errorData = await analysisRes.json().catch(() => ({}));
                throw new Error(errorData.error || `分析に失敗しました (${analysisRes.status})`);
            }

            const analysisData = await analysisRes.json();
            if (!analysisData.success || !analysisData.data) {
                throw new Error(analysisData.error || '分析結果の取得に失敗しました');
            }

            const analysisResult: AnalysisResult = analysisData.data;
            const sources = normalizeSources(analysisResult);

            // Step 2: generate-v2 API
            const genRes = await fetch('/api/generate-v2', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    analysis_result: analysisResult,
                    sender_info: {
                        company_name: params.senderCompany,
                        department: params.senderDepartment || '',
                        name: params.senderName,
                        service_description: params.senderService,
                    },
                    mode: 'complete',
                    output_format: params.outputFormat,
                }),
            });

            if (!genRes.ok) {
                const errorData = await genRes.json().catch(() => ({}));
                throw new Error(errorData.error || `生成に失敗しました (${genRes.status})`);
            }

            const genData = await genRes.json();
            if (!genData.success || !genData.data) {
                throw new Error(genData.error || '生成結果の取得に失敗しました');
            }

            // コンテンツを抽出
            let content = normalizeLetterText(genData.data.body);
            if (params.outputFormat === 'email' && genData.data.subjects && genData.data.subjects.length > 0) {
                content = `件名: ${genData.data.subjects[0]}\n\n${content}`;
            }

            return { success: true, content, sources };
        } catch (error) {
            console.error('[V2 Flow Error]', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : '生成中にエラーが発生しました',
            };
        }
    };

    // Start Sequential Batch Process - Using V2 flow (analyze-input + generate-v2)
    const startBatchProcess = async () => {
        if (!checkProAccess()) return;

        // 1. Validation & Setup
        const validItems = csvData.filter(row => {
            const hasCompany = !!row[mapping.companyName];
            const hasName = nameMode === 'full'
                ? !!row[mapping.name]
                : (!!row[mapping.lastName] && !!row[mapping.firstName]);
            return hasCompany && hasName;
        });

        if (validItems.length === 0) {
            alert('有効なデータがありません');
            return;
        }

        setIsGenerating(true);
        setIsCancelling(false);
        setIsPaused(false);
        setStep('execution');
        setErrorMessage(null);
        setUsageInfo(null);
        cancelRef.current = false;
        pausedRef.current = false;

        // Reset counters
        setProgress({ current: 0, total: validItems.length });
        setResults(validItems.map((_, i) => ({ index: i, status: 'pending' })));
        setStatistics({ successCount: 0, failureCount: 0 });

        // Generate a batch ID for grouping (client-side)
        const batchId = uuidv4();
        setCurrentBatchId(batchId);

        // Get Supabase client
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            setErrorMessage('ログインが必要です');
            setIsGenerating(false);
            return;
        }

        let successCount = 0;
        let failureCount = 0;

        try {
            // Sequential Loop - Call /api/generate for each item
            for (let i = 0; i < validItems.length; i++) {
                // Check Cancellation
                if (cancelRef.current) break;

                // Check Pause (Busy-wait with delay)
                while (pausedRef.current) {
                    if (cancelRef.current) break;
                    await new Promise(resolve => setTimeout(resolve, 500));
                }

                const row = validItems[i];

                // Update Status: Generating
                setResults(prev => {
                    const next = [...prev];
                    next[i] = { ...next[i], status: 'generating' };
                    return next;
                });
                setCurrentCompany(row[mapping.companyName] || '');

                // Prepare Name (姓 名の順序で結合)
                const fullName = nameMode === 'full'
                    ? (row[mapping.name] || '')
                    : `${row[mapping.lastName] || ''}${row[mapping.firstName] ? ' ' + row[mapping.firstName] : ''}`.trim();

                // Debug: 姓名順序の確認
                if (nameMode === 'separate') {
                    console.log(`[Name Order] 姓: ${row[mapping.lastName]}, 名: ${row[mapping.firstName]} → ${fullName}`);
                }

                // Resolve sender info based on senderRule
                let resolvedSenderCompany = senderInfo.myCompanyName;
                let resolvedSenderDepartment = senderInfo.myDepartment;
                let resolvedSenderName = senderInfo.myName;
                const resolvedSenderService = senderInfo.myServiceDescription;

                if (senderRule === 'csv_priority') {
                    // CSV優先: CSVにあればそれを使用、なければデフォルト
                    if (mapping.senderCompany && row[mapping.senderCompany]) {
                        resolvedSenderCompany = row[mapping.senderCompany];
                    }
                    if (mapping.senderDepartment && row[mapping.senderDepartment]) {
                        resolvedSenderDepartment = row[mapping.senderDepartment];
                    }
                    if (mapping.senderName && row[mapping.senderName]) {
                        resolvedSenderName = row[mapping.senderName];
                    }
                }

                // V2フローで生成
                try {
                    // Debug log
                    console.log('[BulkGenerator V2] Generating for:', row[mapping.companyName]);

                    const v2Result = await generateWithV2Flow({
                        targetUrl: mapping.url ? row[mapping.url] : undefined,
                        companyName: row[mapping.companyName] || '',
                        personName: fullName,
                        position: mapping.position ? row[mapping.position] : undefined,
                        background: mapping.background ? row[mapping.background] : undefined,
                        note: mapping.note ? row[mapping.note] : undefined,
                        senderCompany: resolvedSenderCompany || '',
                        senderDepartment: resolvedSenderDepartment || undefined,
                        senderName: resolvedSenderName || '',
                        senderService: resolvedSenderService || '',
                        outputFormat: mediaType === 'mail' ? 'email' : 'letter',
                    });

                    console.log('[BulkGenerator V2] Response:', v2Result.success, v2Result.error || 'OK');

                    if (!v2Result.success || !v2Result.content) {
                        throw new Error(v2Result.error || '生成に失敗しました');
                    }

                    // Extract content
                    const contentToSave = normalizeLetterText(v2Result.content);
                    const emailContent = mediaType === 'mail' ? { subject: '', body: contentToSave } : null;

                    // Save to Supabase letters table
                    const { error: dbError } = await supabase.from('letters').insert({
                        user_id: user.id,
                        content: contentToSave,
                        email_content: emailContent,
                        target_company: row[mapping.companyName] || '',
                        target_name: fullName,
                        batch_id: batchId,
                        status: 'generated',
                        mode: generationMode,
                        model_name: 'gemini-2.0-flash-exp (V2)',
                        inputs: {
                            companyName: row[mapping.companyName] || '',
                            name: fullName,
                            position: mapping.position ? row[mapping.position] : '',
                            department: mapping.recipientDepartment ? row[mapping.recipientDepartment] : '',
                            background: mapping.background ? row[mapping.background] : '',
                        }
                    });

                    if (dbError) {
                        console.error('DB Save Error:', dbError);
                        throw new Error('データベース保存に失敗しました');
                    }

                    successCount++;
                    setResults(prev => {
                        const next = [...prev];
                        next[i] = { ...next[i], status: 'completed', content: contentToSave.substring(0, 100) + '...' };
                        return next;
                    });

                } catch (err) {
                    console.error('Generation Error:', err);
                    failureCount++;

                    // Save failed record to DB
                    await supabase.from('letters').insert({
                        user_id: user.id,
                        content: '',
                        target_company: row[mapping.companyName] || '（不明）',
                        target_name: fullName || '（不明）',
                        batch_id: batchId,
                        status: 'failed',
                        mode: generationMode,
                        error_message: err instanceof Error ? err.message : '生成中にエラーが発生しました',
                        inputs: {
                            companyName: row[mapping.companyName] || '',
                            name: fullName,
                        }
                    });

                    setResults(prev => {
                        const next = [...prev];
                        next[i] = { ...next[i], status: 'error', error: err instanceof Error ? err.message : 'Error' };
                        return next;
                    });
                }

                // Update Progress
                setProgress({ current: i + 1, total: validItems.length });
                setStatistics({ successCount, failureCount });
            }

            // Finalize
            if (cancelRef.current) {
                setErrorMessage('生成を中断しました。');
            }

        } catch (error) {
            console.error('Batch Process Error:', error);
            setErrorMessage(error instanceof Error ? error.message : '一括生成中にエラーが発生しました');
        } finally {
            // Generation is complete (either finished or cancelled)
            // Keep isGenerating true until user clicks finish button
        }
    };

    // ---- Step 1: Upload & Parse ----
    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (!checkProAccess(event)) return;

        const file = event.target.files?.[0];
        if (!file) return;

        const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');

        if (isExcel) {
            // Excel file handling
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target?.result as ArrayBuffer);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const firstSheetName = workbook.SheetNames[0];
                    const firstSheet = workbook.Sheets[firstSheetName];
                    const jsonData = XLSX.utils.sheet_to_json<AnalyzedRow>(firstSheet, { defval: '' });
                    const headers = jsonData.length > 0 ? Object.keys(jsonData[0]) : [];
                    setCsvData(jsonData);
                    setHeaders(headers);
                    autoMapHeaders(headers);
                    setStep('mapping');
                } catch (error) {
                    console.error('Excel Parse Error:', error);
                    alert('Excelファイルの読み込みに失敗しました。');
                }
            };
            reader.readAsArrayBuffer(file);
        } else {
            // CSV file handling (existing logic)
            Papa.parse(file, {
                header: true,
                skipEmptyLines: true,
                complete: (results) => {
                    setCsvData(results.data as AnalyzedRow[]);
                    setHeaders(results.meta.fields || []);
                    autoMapHeaders(results.meta.fields || []);
                    setStep('mapping');
                },
                error: (error) => {
                    console.error('CSV Parse Error:', error);
                    alert('CSVの読み込みに失敗しました。');
                }
            });
        }
    };

    const autoMapHeaders = (fields: string[]) => {
        const newMapping = { ...mapping };

        // Helper to check if a field matches any alias for a key
        const findMatch = (key: keyof typeof ALIASES) => {
            const aliases = ALIASES[key].map(a => a.toLowerCase());
            return fields.find(field => {
                const normalizedField = field.toLowerCase().replace(/[\s_]/g, '');
                return aliases.some(alias => normalizedField.includes(alias.toLowerCase()));
            });
        };

        newMapping.companyName = findMatch('companyName') || '';
        newMapping.name = findMatch('name') || '';
        newMapping.position = findMatch('position') || '';
        newMapping.background = findMatch('background') || '';
        newMapping.note = findMatch('note') || '';
        newMapping.url = findMatch('url') || '';
        newMapping.eventName = findMatch('eventName') || '';
        newMapping.proposal = findMatch('proposal') || '';
        newMapping.senderName = findMatch('senderName') || '';
        newMapping.senderCompany = findMatch('senderCompany') || '';
        newMapping.senderPosition = findMatch('senderPosition') || '';
        newMapping.senderDepartment = findMatch('senderDepartment') || '';
        newMapping.recipientDepartment = findMatch('recipientDepartment') || '';
        newMapping.lastName = findMatch('lastName') || '';
        newMapping.firstName = findMatch('firstName') || '';

        setMapping(newMapping);
    };

    // ---- Step 2: Mapping ----
    const handleMappingChange = (key: keyof MappingConfig, value: string) => {
        setMapping(prev => ({ ...prev, [key]: value }));
    };

    // Validation Logic with Debugging
    const getValidationErrors = React.useCallback(() => {
        const errors: string[] = [];

        // 1. CSV must be uploaded
        if (csvData.length === 0) {
            errors.push('CSVデータ');
            return errors; // Exit early
        }

        // 2. Recipient Validation (Company + Name are required)
        if (!mapping.companyName) errors.push('宛先会社名');

        if (nameMode === 'full') {
            if (!mapping.name) errors.push('宛先氏名');
        } else {
            // For separate mode, lastName is required, firstName is optional
            if (!mapping.lastName) errors.push('宛先姓');
        }

        // 3. Sender Validation based on Rule
        if (senderRule === 'direct') {
            if (!senderInfo.myCompanyName) errors.push('差出人会社名');
            if (!senderInfo.myName) errors.push('差出人氏名');
        } else if (senderRule === 'csv_priority') {
            // At least company column is required; name is nice-to-have but not blocking
            if (!mapping.senderCompany) errors.push('差出人会社名カラム');
        }
        // 'default' mode: no validation needed (uses profile)

        return errors;
    }, [csvData.length, mapping, nameMode, senderRule, senderInfo]);

    // Phase 5: URL列のバリデーション警告を取得
    const getUrlWarnings = React.useCallback(() => {
        const warnings: string[] = [];

        // URLマッピングがない場合
        if (!mapping.url) {
            warnings.push('URL列がマッピングされていません。URLを含めると品質が向上します');
            return warnings;
        }

        // URL列がマッピングされているが、空の行がある場合
        const rowsWithoutUrl = csvData.filter(row => {
            const hasCompany = !!row[mapping.companyName];
            const hasName = nameMode === 'full'
                ? !!row[mapping.name]
                : !!row[mapping.lastName];
            const hasUrl = !!row[mapping.url];
            return hasCompany && hasName && !hasUrl;
        });

        if (rowsWithoutUrl.length > 0) {
            warnings.push(`${rowsWithoutUrl.length}件のデータでURLが空です`);
        }

        return warnings;
    }, [csvData, mapping, nameMode]);

    // Phase 5: プレビュー用のランダム3件を選択
    const selectRandomPreviewItems = React.useCallback(() => {
        const validItems = csvData
            .map((row, index) => ({ row, index }))
            .filter(({ row }) => {
                const hasCompany = !!row[mapping.companyName];
                const hasName = nameMode === 'full'
                    ? !!row[mapping.name]
                    : (!!row[mapping.lastName] && !!row[mapping.firstName]);
                return hasCompany && hasName;
            });

        // ランダムに3件選択
        const shuffled = [...validItems].sort(() => Math.random() - 0.5);
        const selected = shuffled.slice(0, Math.min(3, shuffled.length));

        return selected.map(item => ({
            index: item.index,
            row: item.row,
            status: 'pending' as const,
        }));
    }, [csvData, mapping, nameMode]);

    // Phase 5: プレビュー生成を開始
    const startPreviewGeneration = async () => {
        if (!checkProAccess()) return;

        const selectedItems = selectRandomPreviewItems();
        if (selectedItems.length === 0) {
            alert('プレビューするデータがありません');
            return;
        }

        setPreviewItems(selectedItems);
        setIsPreviewGenerating(true);
        setIsPreviewApproved(false);
        setStep('preview');

        // プレビュー生成を開始
        for (let i = 0; i < selectedItems.length; i++) {
            const item = selectedItems[i];

            // ステータスを更新
            setPreviewItems(prev => {
                const next = [...prev];
                next[i] = { ...next[i], status: 'generating' };
                return next;
            });

            try {
                // 名前を構築
                const fullName = nameMode === 'full'
                    ? (item.row[mapping.name] || '')
                    : `${item.row[mapping.lastName] || ''}${item.row[mapping.firstName] ? ' ' + item.row[mapping.firstName] : ''}`.trim();

                // 差出人情報を解決
                let resolvedSenderCompany = senderInfo.myCompanyName;
                let resolvedSenderDepartment = senderInfo.myDepartment;
                let resolvedSenderName = senderInfo.myName;
                const resolvedSenderService = senderInfo.myServiceDescription;

                if (senderRule === 'csv_priority') {
                    if (mapping.senderCompany && item.row[mapping.senderCompany]) {
                        resolvedSenderCompany = item.row[mapping.senderCompany];
                    }
                    if (mapping.senderDepartment && item.row[mapping.senderDepartment]) {
                        resolvedSenderDepartment = item.row[mapping.senderDepartment];
                    }
                    if (mapping.senderName && item.row[mapping.senderName]) {
                        resolvedSenderName = item.row[mapping.senderName];
                    }
                }

                // V2フローで生成
                console.log('[BulkGenerator V2 Preview] Generating for:', item.row[mapping.companyName]);

                const v2Result = await generateWithV2Flow({
                    targetUrl: mapping.url ? item.row[mapping.url] : undefined,
                    companyName: item.row[mapping.companyName] || '',
                    personName: fullName,
                    position: mapping.position ? item.row[mapping.position] : undefined,
                    background: mapping.background ? item.row[mapping.background] : undefined,
                    note: mapping.note ? item.row[mapping.note] : undefined,
                    senderCompany: resolvedSenderCompany || '',
                    senderDepartment: resolvedSenderDepartment || undefined,
                    senderName: resolvedSenderName || '',
                    senderService: resolvedSenderService || '',
                    outputFormat: mediaType === 'mail' ? 'email' : 'letter',
                });

                if (!v2Result.success || !v2Result.content) {
                    throw new Error(v2Result.error || '生成に失敗しました');
                }

                const contentToShow = normalizeLetterText(v2Result.content);

                setPreviewItems(prev => {
                    const next = [...prev];
                    next[i] = { ...next[i], status: 'completed', content: contentToShow, sources: v2Result.sources };
                    return next;
                });

            } catch (err) {
                console.error('Preview generation error:', err);
                setPreviewItems(prev => {
                    const next = [...prev];
                    next[i] = { ...next[i], status: 'error', error: err instanceof Error ? err.message : 'エラー' };
                    return next;
                });
            }
        }

        setIsPreviewGenerating(false);
    };

    // Phase 5: プレビュー承認後に残り全件を生成
    const startFullGeneration = async () => {
        setIsPreviewApproved(true);
        setStep('execution');
        await startBatchProcess();
    };

    // Phase 5: プレビューをシャッフル（別の3件を選び直す）
    const reshufflePreview = () => {
        setPreviewItems([]);
        startPreviewGeneration();
    };

    // isMappingValid is kept for backward compatibility but internally uses getValidationErrors
    const _isMappingValid = React.useCallback(() => {
        const errors = getValidationErrors();
        if (errors.length > 0) {
            console.log('[Validation Debug] Failed. Missing:', errors);
            return false;
        }
        console.log('[Validation Debug] Passed!');
        return true;
    }, [getValidationErrors]);

    // ---- Step 3: Execution ----

    const _handleReset = () => {
        setCsvData([]);
        setResults([]);
        setErrorMessage(null);
        setStatistics({ successCount: 0, failureCount: 0 });
        setShowSuccessModal(false);
        setStep('upload');
        setCurrentBatchId(null);
        setIsGenerating(false);
        setIsPaused(false);
        setCurrentCompany('');

        // Reset file input if exists
        const fileInput = document.getElementById('file-upload') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
    };

    const handleBatchFinish = (action: 'history' | 'stay') => {
        if (action === 'history' && currentBatchId) {
            router.push(`/dashboard/history/batch/${currentBatchId}?highlight=true`);
        } else {
            // 'stay': Close modal, allow user to see the table.
            setIsGenerating(false);
            // We might want to keep the results visible.
        }
    };


    // ---- Renderers ----

    if (step === 'upload') {
        return (
            <div className="max-w-2xl mx-auto bg-white p-8 rounded-xl shadow-sm border border-slate-200">
                {/* 生成設定オプション */}
                <div className="mb-8 pb-6 border-b border-slate-200">
                    <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <span className="bg-amber-100 text-amber-700 w-8 h-8 rounded-full flex items-center justify-center text-sm">⚙️</span>
                        生成設定
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* 媒体タイプ */}
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-3">媒体タイプ</label>
                            <div className="flex gap-3">
                                <label className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 cursor-pointer transition-all ${mediaType === 'letter'
                                    ? 'border-amber-500 bg-amber-50 text-amber-800'
                                    : 'border-slate-200 hover:border-slate-300 text-slate-600'
                                    }`}>
                                    <input
                                        type="radio"
                                        name="mediaType"
                                        value="letter"
                                        checked={mediaType === 'letter'}
                                        onChange={() => setMediaType('letter')}
                                        className="sr-only"
                                    />
                                    <span className="text-lg">✉️</span>
                                    <span className="font-medium">手紙</span>
                                </label>
                                <label className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 cursor-pointer transition-all ${mediaType === 'mail'
                                    ? 'border-blue-500 bg-blue-50 text-blue-800'
                                    : 'border-slate-200 hover:border-slate-300 text-slate-600'
                                    }`}>
                                    <input
                                        type="radio"
                                        name="mediaType"
                                        value="mail"
                                        checked={mediaType === 'mail'}
                                        onChange={() => setMediaType('mail')}
                                        className="sr-only"
                                    />
                                    <span className="text-lg">📧</span>
                                    <span className="font-medium">メール</span>
                                </label>
                            </div>
                        </div>

                        {/* 生成モード */}
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-3">生成モード</label>
                            <div className="flex gap-3">
                                <label className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 cursor-pointer transition-all ${generationMode === 'sales'
                                    ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                                    : 'border-slate-200 hover:border-slate-300 text-slate-600'
                                    }`}>
                                    <input
                                        type="radio"
                                        name="generationMode"
                                        value="sales"
                                        checked={generationMode === 'sales'}
                                        onChange={() => setGenerationMode('sales')}
                                        className="sr-only"
                                    />
                                    <span className="text-lg">💼</span>
                                    <span className="font-medium">セールス</span>
                                </label>
                                <label className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 cursor-pointer transition-all ${generationMode === 'event'
                                    ? 'border-purple-500 bg-purple-50 text-purple-800'
                                    : 'border-slate-200 hover:border-slate-300 text-slate-600'
                                    }`}>
                                    <input
                                        type="radio"
                                        name="generationMode"
                                        value="event"
                                        checked={generationMode === 'event'}
                                        onChange={() => setGenerationMode('event')}
                                        className="sr-only"
                                    />
                                    <span className="text-lg">🎉</span>
                                    <span className="font-medium">イベント招待</span>
                                </label>
                            </div>
                        </div>
                    </div>
                </div>

                <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                    <span className="bg-slate-100 text-slate-600 w-8 h-8 rounded-full flex items-center justify-center text-sm">1</span>
                    CSV / Excelファイルのアップロード
                </h2>

                <div className="border-2 border-dashed border-slate-300 rounded-lg p-12 text-center hover:bg-slate-50 transition-colors relative">
                    <input
                        type="file"
                        accept=".csv,.xlsx,.xls"
                        onChange={handleFileUpload}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <Upload className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                    <p className="text-slate-600 font-medium">CSV / Excelファイルをここにドラッグ&ドロップ</p>
                    <p className="text-slate-400 text-sm mt-2">または クリックしてファイルを選択（.csv, .xlsx, .xls）</p>
                </div>

                <div className="mt-8">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                            <HelpCircle className="w-5 h-5 text-blue-600" />
                            CSV作成ガイド
                        </h3>
                        <button
                            onClick={handleDownloadTemplate}
                            className="text-sm flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium border border-blue-200 px-3 py-1.5 rounded-md hover:bg-blue-50 transition-colors"
                        >
                            <Download className="w-4 h-4" />
                            テンプレートをダウンロード
                        </button>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 rounded-lg overflow-hidden">
                        <button
                            onClick={() => setIsGuideOpen(!isGuideOpen)}
                            className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-100 transition-colors"
                        >
                            <span className="font-semibold text-slate-700">📌 推奨フォーマット・記載項目のヒント</span>
                            {isGuideOpen ? <ChevronUp className="w-5 h-5 text-slate-500" /> : <ChevronDown className="w-5 h-5 text-slate-500" />}
                        </button>

                        {isGuideOpen && (
                            <div className="p-4 border-t border-slate-200 bg-white">
                                <div className="flex flex-col space-y-4">
                                    {/* Common Rules - Card-like styling for emphasis */}
                                    <div className="border-l-4 border-slate-800 bg-slate-50 pl-4 py-2 rounded-r">
                                        <h4 className="font-bold text-slate-800 text-sm mb-1 flex items-center gap-2">
                                            <FileSpreadsheet className="w-4 h-4" />
                                            共通ルール
                                        </h4>
                                        <p className="text-sm text-slate-600">
                                            1行目は必ず<span className="font-bold">「ヘッダー（列名）」</span>にしてください。
                                            <span className="font-bold text-red-600 ml-2">「会社名」「氏名」は必須です。</span>
                                        </p>
                                    </div>

                                    {/* Vertical Stack of Recommendations */}
                                    <div className="space-y-3">
                                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 flex flex-col md:flex-row md:items-start gap-3">
                                            <div className="md:w-32 flex-shrink-0">
                                                <span className="font-bold text-blue-800 text-sm">🅰️ セールスレター</span>
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-xs text-blue-900 mb-1 font-semibold">推奨列名とその用途:</p>
                                                <div className="flex flex-wrap gap-2">
                                                    <span className="text-xs bg-white px-2 py-1 rounded border border-blue-200 text-slate-700"><code>役職</code></span>
                                                    <span className="text-xs bg-white px-2 py-1 rounded border border-blue-200 text-slate-700"><code>提案内容</code> (件名)</span>
                                                    <span className="text-xs bg-white px-2 py-1 rounded border border-blue-200 text-slate-700"><code>背景</code> (フック文脈)</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="bg-purple-50 p-4 rounded-lg border border-purple-100 flex flex-col md:flex-row md::items-start gap-3">
                                            <div className="md:w-32 flex-shrink-0">
                                                <span className="font-bold text-purple-800 text-sm">🅱️ イベント招待</span>
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-xs text-purple-900 mb-1 font-semibold">推奨列名とその用途:</p>
                                                <div className="flex flex-wrap gap-2">
                                                    <span className="text-xs bg-white px-2 py-1 rounded border border-purple-200 text-slate-700"><code>イベント名</code></span>
                                                    <span className="text-xs bg-white px-2 py-1 rounded border border-purple-200 text-slate-700"><code>備考</code> (日時・場所)</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-100 flex flex-col md:flex-row md:items-start gap-3">
                                            <div className="md:w-32 flex-shrink-0">
                                                <span className="font-bold text-emerald-800 text-sm">🔍 AI自動調査</span>
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-xs text-emerald-900 mb-1 font-semibold">便利な列:</p>
                                                <div className="flex flex-wrap gap-2 items-center">
                                                    <span className="text-xs bg-white px-2 py-1 rounded border border-emerald-200 text-slate-700"><code>URL</code></span>
                                                    <span className="text-[10px] text-emerald-700 ml-2">※Webサイトを分析し、詳細を補完します。</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                        {!isGuideOpen && (
                            <div className="px-4 pb-4 text-xs text-slate-500">
                                クリックして、推奨列名や作成のヒントを確認できます。
                            </div>
                        )}
                    </div>
                </div>
                <ProFeatureModal
                    isOpen={showProModal}
                    onClose={() => setShowProModal(false)}
                    featureName="CSV一括生成機能"
                />
            </div>
        );
    }

    if (step === 'mapping') {
        const handleDirectSenderChange = (key: string, value: string) => {
            setSenderInfo(prev => ({ ...prev, [key]: value }));
        };

        return (
            <div className="max-w-6xl mx-auto bg-white p-8 rounded-xl shadow-sm border border-slate-200">
                <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                    <span className="bg-slate-100 text-slate-600 w-8 h-8 rounded-full flex items-center justify-center text-sm">2</span>
                    データのマッピング
                </h2>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
                    {/* Top Left: Main Mapping Info (66%) */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
                            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                                <span className="text-xl">🏢</span> 宛先情報 (必須)
                            </h3>
                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <label className="block text-sm font-bold text-slate-700">会社名 <span className="text-red-500">*</span></label>
                                    <select
                                        value={mapping.companyName}
                                        onChange={(e) => handleMappingChange('companyName', e.target.value)}
                                        className="w-full border border-slate-300 rounded-md p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                                    >
                                        <option value="">選択してください</option>
                                        {headers.map(h => <option key={h} value={h}>{h}</option>)}
                                    </select>
                                </div>

                                <div className="space-y-1">
                                    <div className="flex items-center justify-between mb-1">
                                        <label className="block text-sm font-bold text-slate-700">氏名 <span className="text-red-500">*</span></label>
                                        <button
                                            onClick={() => setNameMode(m => m === 'full' ? 'separate' : 'full')}
                                            className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                                        >
                                            <RefreshCw className="w-3 h-3" />
                                            {nameMode === 'full' ? '姓・名に分ける' : 'フルネームに戻す'}
                                        </button>
                                    </div>
                                    {nameMode === 'full' ? (
                                        <select
                                            value={mapping.name}
                                            onChange={(e) => handleMappingChange('name', e.target.value)}
                                            className="w-full border border-slate-300 rounded-md p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                                        >
                                            <option value="">選択してください</option>
                                            {headers.map(h => <option key={h} value={h}>{h}</option>)}
                                        </select>
                                    ) : (
                                        <div className="grid grid-cols-2 gap-2">
                                            <select
                                                value={mapping.lastName}
                                                onChange={(e) => handleMappingChange('lastName', e.target.value)}
                                                className="w-full border border-slate-300 rounded-md p-2 text-sm"
                                            >
                                                <option value="">姓 (Last)</option>
                                                {headers.map(h => <option key={h} value={h}>{h}</option>)}
                                            </select>
                                            <select
                                                value={mapping.firstName}
                                                onChange={(e) => handleMappingChange('firstName', e.target.value)}
                                                className="w-full border border-slate-300 rounded-md p-2 text-sm"
                                            >
                                                <option value="">名 (First)</option>
                                                {headers.map(h => <option key={h} value={h}>{h}</option>)}
                                            </select>
                                        </div>
                                    )}
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="block text-sm font-medium text-slate-700">部署名</label>
                                        <select
                                            value={mapping.recipientDepartment}
                                            onChange={(e) => handleMappingChange('recipientDepartment', e.target.value)}
                                            className="w-full border border-slate-300 rounded-md p-2 outline-none"
                                        >
                                            <option value="">（なし）</option>
                                            {headers.map(h => <option key={h} value={h}>{h}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="block text-sm font-medium text-slate-700">役職</label>
                                        <select
                                            value={mapping.position}
                                            onChange={(e) => handleMappingChange('position', e.target.value)}
                                            className="w-full border border-slate-300 rounded-md p-2 outline-none"
                                        >
                                            <option value="">（なし）</option>
                                            {headers.map(h => <option key={h} value={h}>{h}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Top Left: Optional Fields */}
                        <div className="bg-white p-6 rounded-xl border border-slate-200">
                            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                                <span className="text-xl">📝</span> 生成コンテンツ用情報
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="block text-sm font-medium text-slate-700">背景・目的</label>
                                    <select value={mapping.background} onChange={(e) => handleMappingChange('background', e.target.value)} className="w-full border border-slate-300 rounded-md p-2 outline-none"><option value="">（なし）</option>{headers.map(h => <option key={h} value={h}>{h}</option>)}</select>
                                </div>
                                <div className="space-y-1">
                                    <label className="block text-sm font-medium text-slate-700">備考</label>
                                    <select value={mapping.note} onChange={(e) => handleMappingChange('note', e.target.value)} className="w-full border border-slate-300 rounded-md p-2 outline-none"><option value="">（なし）</option>{headers.map(h => <option key={h} value={h}>{h}</option>)}</select>
                                </div>
                                <div className="space-y-1">
                                    <label className="block text-sm font-medium text-slate-700">提案内容 (件名)</label>
                                    <select value={mapping.proposal} onChange={(e) => handleMappingChange('proposal', e.target.value)} className="w-full border border-slate-300 rounded-md p-2 outline-none"><option value="">（なし）</option>{headers.map(h => <option key={h} value={h}>{h}</option>)}</select>
                                </div>
                                <div className="space-y-1">
                                    <label className="block text-sm font-medium text-slate-700">URL (AI自動調査)</label>
                                    <select value={mapping.url} onChange={(e) => handleMappingChange('url', e.target.value)} className="w-full border border-slate-300 rounded-md p-2 outline-none"><option value="">（なし）</option>{headers.map(h => <option key={h} value={h}>{h}</option>)}</select>
                                </div>
                                <div className="space-y-1">
                                    <label className="block text-sm font-medium text-slate-700">イベント名</label>
                                    <select value={mapping.eventName} onChange={(e) => handleMappingChange('eventName', e.target.value)} className="w-full border border-slate-300 rounded-md p-2 outline-none"><option value="">（なし）</option>{headers.map(h => <option key={h} value={h}>{h}</option>)}</select>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Top Right: Options (33%) */}
                    <div className="lg:col-span-1 space-y-6">
                        <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 h-full">
                            <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                                <span className="text-xl">⚙️</span> 生成オプション
                            </h3>

                            <div className="space-y-6">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">媒体タイプ</label>
                                    <div className="flex flex-col gap-2">
                                        <label className={`flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer transition-all ${mediaType === 'letter' ? 'border-amber-500 bg-amber-50 text-amber-900' : 'border-slate-200 bg-white'}`}>
                                            <input type="radio" name="mediaTypeOption" value="letter" checked={mediaType === 'letter'} onChange={() => setMediaType('letter')} className="w-4 h-4 text-amber-600" />
                                            <span className="text-sm font-medium">✉️ 手紙 (Letter)</span>
                                        </label>
                                        <label className={`flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer transition-all ${mediaType === 'mail' ? 'border-blue-500 bg-blue-50 text-blue-900' : 'border-slate-200 bg-white'}`}>
                                            <input type="radio" name="mediaTypeOption" value="mail" checked={mediaType === 'mail'} onChange={() => setMediaType('mail')} className="w-4 h-4 text-blue-600" />
                                            <span className="text-sm font-medium">📧 メール (Email)</span>
                                        </label>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">生成モード</label>
                                    <div className="flex flex-col gap-2">
                                        <label className={`flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer transition-all ${generationMode === 'sales' ? 'border-emerald-500 bg-emerald-50 text-emerald-900' : 'border-slate-200 bg-white'}`}>
                                            <input type="radio" name="genModeOption" value="sales" checked={generationMode === 'sales'} onChange={() => setGenerationMode('sales')} className="w-4 h-4 text-emerald-600" />
                                            <span className="text-sm font-medium">💼 セールス (Sales)</span>
                                        </label>
                                        <label className={`flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer transition-all ${generationMode === 'event' ? 'border-purple-500 bg-purple-50 text-purple-900' : 'border-slate-200 bg-white'}`}>
                                            <input type="radio" name="genModeOption" value="event" checked={generationMode === 'event'} onChange={() => setGenerationMode('event')} className="w-4 h-4 text-purple-600" />
                                            <span className="text-sm font-medium">🎉 イベント招待 (Event)</span>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Bottom: Sender Info Section */}
                <div className="border-t border-slate-200 pt-8 mt-8">
                    <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                        <span className="bg-slate-100 text-slate-600 w-8 h-8 rounded-full flex items-center justify-center text-sm">3</span>
                        差出人情報の設定
                    </h2>

                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-6">
                        <div className="flex flex-wrap gap-4 mb-6">
                            <label className={`flex items-center gap-2 px-4 py-2 rounded-full border cursor-pointer transition-all ${senderRule === 'default' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`}>
                                <input type="radio" name="senderRule" value="default" checked={senderRule === 'default'} onChange={() => setSenderRule('default')} className="sr-only" />
                                <span className="font-bold">登録情報を使用 (Default)</span>
                            </label>
                            <label className={`flex items-center gap-2 px-4 py-2 rounded-full border cursor-pointer transition-all ${senderRule === 'direct' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`}>
                                <input type="radio" name="senderRule" value="direct" checked={senderRule === 'direct'} onChange={() => setSenderRule('direct')} className="sr-only" />
                                <span className="font-bold">直接入力 (Custom)</span>
                            </label>
                            <label className={`flex items-center gap-2 px-4 py-2 rounded-full border cursor-pointer transition-all ${senderRule === 'csv_priority' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`}>
                                <input type="radio" name="senderRule" value="csv_priority" checked={senderRule === 'csv_priority'} onChange={() => setSenderRule('csv_priority')} className="sr-only" />
                                <span className="font-bold">CSVから引用 (From CSV)</span>
                            </label>
                        </div>

                        {/* Mode A: Default */}
                        {senderRule === 'default' && (
                            <div className="bg-white p-6 rounded-lg border border-slate-200">
                                <div className="flex items-start justify-between">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 w-full">
                                        <div><span className="text-xs text-slate-500 block">会社名</span><p className="font-bold text-slate-800">{senderInfo.myCompanyName || '（未設定）'}</p></div>
                                        <div><span className="text-xs text-slate-500 block">部署名</span><p className="font-bold text-slate-800">{senderInfo.myDepartment || '（未設定）'}</p></div>
                                        <div><span className="text-xs text-slate-500 block">氏名</span><p className="font-bold text-slate-800">{senderInfo.myName || '（未設定）'}</p></div>
                                        <div><span className="text-xs text-slate-500 block">サービス概要</span><p className="text-sm text-slate-600 line-clamp-2">{senderInfo.myServiceDescription || '（未設定）'}</p></div>
                                    </div>
                                    <a href="/settings" target="_blank" className="text-sm text-blue-600 hover:underline flex-shrink-0 ml-4">設定を変更 ↗</a>
                                </div>
                            </div>
                        )}

                        {/* Mode B: Direct Input */}
                        {senderRule === 'direct' && (
                            <div className="bg-white p-6 rounded-lg border border-slate-200 space-y-4">
                                <div className="flex gap-2 mb-4">
                                    <input
                                        type="text"
                                        placeholder="会社URLを入力して自動入力 (例: https://example.com)"
                                        className="flex-1 border border-slate-300 rounded-md px-3 py-2 text-sm"
                                        value={aiUrl}
                                        onChange={(e) => setAiUrl(e.target.value)}
                                    />
                                    <button
                                        onClick={handleUrlAnalysis}
                                        disabled={isAnalyzing || !aiUrl}
                                        className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 disabled:opacity-50 hover:bg-blue-700"
                                    >
                                        {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                                        AI自動入力
                                    </button>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div><label className="block text-xs font-bold text-slate-700 mb-1">会社名</label><input type="text" value={senderInfo.myCompanyName} onChange={(e) => handleDirectSenderChange('myCompanyName', e.target.value)} className="w-full border border-slate-300 rounded-md p-2" /></div>
                                    <div><label className="block text-xs font-bold text-slate-700 mb-1">部署名</label><input type="text" value={senderInfo.myDepartment} onChange={(e) => handleDirectSenderChange('myDepartment', e.target.value)} className="w-full border border-slate-300 rounded-md p-2" /></div>
                                    <div><label className="block text-xs font-bold text-slate-700 mb-1">氏名</label><input type="text" value={senderInfo.myName} onChange={(e) => handleDirectSenderChange('myName', e.target.value)} className="w-full border border-slate-300 rounded-md p-2" /></div>
                                    <div><label className="block text-xs font-bold text-slate-700 mb-1">役職</label><input type="text" value={senderInfo.myPosition} onChange={(e) => handleDirectSenderChange('myPosition', e.target.value)} className="w-full border border-slate-300 rounded-md p-2" /></div>
                                </div>
                                <div><label className="block text-xs font-bold text-slate-700 mb-1">サービス概要</label><textarea rows={2} value={senderInfo.myServiceDescription} onChange={(e) => handleDirectSenderChange('myServiceDescription', e.target.value)} className="w-full border border-slate-300 rounded-md p-2" /></div>
                            </div>
                        )}

                        {/* Mode C: CSV Mapping */}
                        {senderRule === 'csv_priority' && (
                            <div className="bg-white p-6 rounded-lg border border-slate-200">
                                <p className="text-sm text-slate-600 mb-4 flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4 text-amber-500" />
                                    CSVファイル内のカラムを選択してください。行ごとに異なる差出人を設定できます。
                                </p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div><label className="block text-xs font-medium text-slate-700 mb-1">差出人会社名カラム</label><select value={mapping.senderCompany} onChange={(e) => handleMappingChange('senderCompany', e.target.value)} className="w-full border border-slate-300 rounded-md p-2"><option value="">（選択してください）</option>{headers.map(h => <option key={h} value={h}>{h}</option>)}</select></div>
                                    <div><label className="block text-xs font-medium text-slate-700 mb-1">差出人部署名カラム</label><select value={mapping.senderDepartment} onChange={(e) => handleMappingChange('senderDepartment', e.target.value)} className="w-full border border-slate-300 rounded-md p-2"><option value="">（選択してください）</option>{headers.map(h => <option key={h} value={h}>{h}</option>)}</select></div>
                                    <div><label className="block text-xs font-medium text-slate-700 mb-1">差出人氏名カラム</label><select value={mapping.senderName} onChange={(e) => handleMappingChange('senderName', e.target.value)} className="w-full border border-slate-300 rounded-md p-2"><option value="">（選択してください）</option>{headers.map(h => <option key={h} value={h}>{h}</option>)}</select></div>
                                    <div><label className="block text-xs font-medium text-slate-700 mb-1">差出人役職カラム</label><select value={mapping.senderPosition} onChange={(e) => handleMappingChange('senderPosition', e.target.value)} className="w-full border border-slate-300 rounded-md p-2"><option value="">（選択してください）</option>{headers.map(h => <option key={h} value={h}>{h}</option>)}</select></div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Phase 5: URL警告 */}
                {getUrlWarnings().length > 0 && (
                    <div className="mt-6 bg-amber-50 border border-amber-200 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                            <div>
                                <h4 className="font-medium text-amber-800 mb-1">品質向上のヒント</h4>
                                <ul className="text-sm text-amber-700 space-y-1">
                                    {getUrlWarnings().map((warning, i) => (
                                        <li key={i}>• {warning}</li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>
                )}

                {/* Footer Action */}
                <div className="mt-8 flex justify-center pt-6 border-t border-slate-200 relative">
                    <button
                        onClick={startPreviewGeneration}
                        disabled={getValidationErrors().length > 0 || isGenerating || isPreviewGenerating}
                        className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold py-4 px-12 rounded-full shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all text-lg flex items-center gap-2 disabled:opacity-50 disabled:transform-none disabled:shadow-none"
                    >
                        {isPreviewGenerating ? (
                            <>
                                <Loader2 className="w-6 h-6 animate-spin" />
                                プレビュー生成中...
                            </>
                        ) : (
                            <>
                                <Eye className="w-6 h-6" />
                                プレビューを生成
                            </>
                        )}
                    </button>
                    {getValidationErrors().length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-3 text-center">
                            <p className="text-xs text-red-500 font-bold bg-red-50 py-1 px-3 rounded-full inline-flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" />
                                未設定: {getValidationErrors().join('、')}
                            </p>
                        </div>
                    )}
                    <button
                        onClick={() => setStep('upload')}
                        className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium absolute right-8"
                    >
                        戻る
                    </button>
                </div>
            </div >
        );
    }

    // Phase 5: Preview Step
    if (step === 'preview') {
        const completedCount = previewItems.filter(item => item.status === 'completed').length;
        const totalCount = previewItems.length;

        return (
            <div className="p-8 max-w-5xl mx-auto">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full mb-4">
                        <Eye className="w-8 h-8 text-white" />
                    </div>
                    <h2 className="text-3xl font-bold text-slate-800 mb-2">プレビュー確認</h2>
                    <p className="text-slate-500">
                        ランダムに選んだ{totalCount}件のサンプルを確認し、品質をチェックしてください
                    </p>
                </div>

                {/* CTA選択セクション */}
                <div className="bg-white border border-slate-200 rounded-xl p-6 mb-6">
                    <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                        <ArrowRight className="w-5 h-5 text-indigo-600" />
                        CTAタイプを選択
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {(Object.keys(CTA_OPTIONS) as CtaType[]).map((type) => (
                            <label
                                key={type}
                                className={`relative flex flex-col p-4 border-2 rounded-xl cursor-pointer transition-all ${
                                    ctaType === type
                                        ? 'border-indigo-500 bg-indigo-50'
                                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                                }`}
                            >
                                <input
                                    type="radio"
                                    name="ctaType"
                                    value={type}
                                    checked={ctaType === type}
                                    onChange={(e) => setCtaType(e.target.value as CtaType)}
                                    className="sr-only"
                                />
                                <span className="font-medium text-slate-800 mb-1">
                                    {CTA_OPTIONS[type].label}
                                </span>
                                <span className="text-xs text-slate-500 line-clamp-2">
                                    {CTA_OPTIONS[type].template}
                                </span>
                                {ctaType === type && (
                                    <div className="absolute top-2 right-2">
                                        <Check className="w-5 h-5 text-indigo-600" />
                                    </div>
                                )}
                            </label>
                        ))}
                    </div>
                </div>

                {/* プレビュー一覧 */}
                <div className="space-y-4 mb-8">
                    {previewItems.map((item, index) => (
                        <div key={index} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                            {/* ヘッダー */}
                            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <span className="inline-flex items-center justify-center w-8 h-8 bg-indigo-100 text-indigo-700 rounded-full font-bold text-sm">
                                        {index + 1}
                                    </span>
                                    <div>
                                        <p className="font-semibold text-slate-800">
                                            {item.row[mapping.companyName] || '企業名なし'}
                                        </p>
                                        <p className="text-sm text-slate-500">
                                            {nameMode === 'full'
                                                ? item.row[mapping.name]
                                                : `${item.row[mapping.lastName] || ''} ${item.row[mapping.firstName] || ''}`.trim()
                                            } 様
                                        </p>
                                    </div>
                                </div>
                                <div>
                                    {item.status === 'pending' && (
                                        <span className="text-sm text-slate-400">待機中...</span>
                                    )}
                                    {item.status === 'generating' && (
                                        <span className="flex items-center gap-2 text-sm text-blue-600">
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            生成中...
                                        </span>
                                    )}
                                    {item.status === 'completed' && (
                                        <span className="flex items-center gap-1 text-sm text-green-600">
                                            <CheckCircle2 className="w-4 h-4" />
                                            完了
                                        </span>
                                    )}
                                    {item.status === 'error' && (
                                        <span className="flex items-center gap-1 text-sm text-red-600">
                                            <AlertCircle className="w-4 h-4" />
                                            エラー
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* コンテンツ */}
                            <div className="p-6">
                                {item.status === 'completed' && item.content ? (
                                    <>
                                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                                            <pre className="whitespace-pre-wrap text-sm text-slate-700 font-sans leading-relaxed">
                                                {item.content}
                                            </pre>
                                        </div>
                                        <SourcesDisplay
                                            sources={item.sources}
                                            hasUrl={!!item.row[mapping.url]}
                                            className="mt-4"
                                        />
                                    </>
                                ) : item.status === 'error' ? (
                                    <div className="bg-red-50 p-4 rounded-lg border border-red-200 text-red-700 text-sm">
                                        {item.error || 'エラーが発生しました'}
                                    </div>
                                ) : (
                                    <div className="h-32 flex items-center justify-center text-slate-400">
                                        {item.status === 'generating' ? (
                                            <Loader2 className="w-8 h-8 animate-spin" />
                                        ) : (
                                            <span>生成待ち</span>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* アクションボタン */}
                <div className="flex items-center justify-center gap-4 pt-6 border-t border-slate-200">
                    <button
                        onClick={() => setStep('mapping')}
                        className="px-6 py-3 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors"
                    >
                        マッピングに戻る
                    </button>

                    <button
                        onClick={reshufflePreview}
                        disabled={isPreviewGenerating}
                        className="px-6 py-3 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                        <Shuffle className="w-5 h-5" />
                        別のサンプルを選ぶ
                    </button>

                    <button
                        onClick={startFullGeneration}
                        disabled={isPreviewGenerating || completedCount < totalCount}
                        className="bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold py-3 px-8 rounded-full shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all flex items-center gap-2 disabled:opacity-50 disabled:transform-none"
                    >
                        <Play className="w-5 h-5 fill-current" />
                        承認して全件生成を開始
                    </button>
                </div>

                {/* 進行状況 */}
                {isPreviewGenerating && (
                    <div className="mt-4 text-center">
                        <p className="text-sm text-slate-500">
                            {completedCount} / {totalCount} 件のプレビューが完了
                        </p>
                    </div>
                )}
                <ProFeatureModal
                    isOpen={showProModal}
                    onClose={() => setShowProModal(false)}
                    featureName="CSV一括生成機能"
                />
            </div>
        );
    }

    // Execution Step
    return (
        <div className="max-w-4xl mx-auto bg-white p-8 rounded-xl shadow-sm border border-slate-200">
            <BatchProgressModal
                isOpen={isGenerating}
                progress={progress.current}
                total={progress.total}
                currentCompany={currentCompany}
                batchId={currentBatchId || ''}
                onFinish={handleBatchFinish}
                statistics={{ success: statistics.successCount, failure: statistics.failureCount }}
            />

            <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    <span className="bg-slate-100 text-slate-600 w-8 h-8 rounded-full flex items-center justify-center text-sm">3</span>
                    生成進捗
                </h2>
                <div className="flex items-center gap-4">
                    <div className="text-sm font-medium text-slate-600">
                        {progress.current} / {progress.total} 件完了
                    </div>
                </div>
            </div>

            {/* Error Display */}
            {errorMessage && (
                <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                            <h3 className="font-bold text-red-900 mb-2">エラーが発生しました</h3>
                            <p className="text-sm text-red-800 mb-3">{errorMessage}</p>

                            {/* Usage Statistics */}
                            {usageInfo && (
                                <div className="bg-white rounded-md p-3 border border-red-100">
                                    <div className="text-xs font-semibold text-red-900 mb-2">📊 本日の使用状況</div>
                                    <div className="grid grid-cols-3 gap-2 text-xs">
                                        <div>
                                            <span className="text-slate-600">使用済み:</span>
                                            <span className="ml-1 font-bold text-red-800">{usageInfo.usedToday}件</span>
                                        </div>
                                        <div>
                                            <span className="text-slate-600">上限:</span>
                                            <span className="ml-1 font-bold text-slate-900">{usageInfo.dailyLimit}件</span>
                                        </div>
                                        <div>
                                            <span className="text-slate-600">残り:</span>
                                            <span className="ml-1 font-bold text-blue-600">{usageInfo.remaining}件</span>
                                        </div>
                                    </div>
                                    <div className="mt-2 pt-2 border-t border-red-100">
                                        <span className="text-xs text-slate-600">現在のプラン: </span>
                                        <span className="text-xs font-bold text-slate-900 uppercase">{usageInfo.userPlan}</span>
                                    </div>
                                </div>
                            )}

                            {/* Action Buttons */}
                            <div className="flex gap-2 mt-4">
                                <button
                                    onClick={() => {
                                        setErrorMessage(null);
                                        setUsageInfo(null);
                                        setStep('mapping');
                                    }}
                                    className="px-4 py-2 text-sm bg-white border border-red-300 text-red-700 rounded-md hover:bg-red-50 font-medium"
                                >
                                    設定を修正
                                </button>
                                {usageInfo && usageInfo.userPlan !== 'premium' && (
                                    <button
                                        onClick={() => { /* router.push('/dashboard/pricing') */ }}
                                        className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
                                    >
                                        プランをアップグレード
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="w-full bg-slate-100 rounded-full h-2 mb-4 overflow-hidden">
                <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }}
                />
            </div>

            <div className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="max-h-[500px] overflow-y-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200 sticky top-0">
                            <tr>
                                <th className="px-4 py-3 w-16">No.</th>
                                <th className="px-4 py-3">会社名 / 氏名</th>
                                <th className="px-4 py-3 w-32">ステータス</th>
                                <th className="px-4 py-3">結果</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {csvData.filter(r => r[mapping.companyName] && r[mapping.name]).map((row, i) => {
                                const result = results[i] || { index: i, status: 'pending' };
                                const company = row[mapping.companyName];
                                const name = row[mapping.name];
                                const status = result.status;

                                return (
                                    <tr key={i} className="hover:bg-slate-50">
                                        <td className="px-4 py-3 text-slate-500">{i + 1}</td>
                                        <td className="px-4 py-3">
                                            <div className="font-medium text-slate-900">{company}</div>
                                            <div className="text-slate-500 text-xs">{name}</div>
                                        </td>
                                        <td className="px-4 py-3">
                                            {status === 'pending' && <span className="text-slate-400 text-xs">待機中</span>}
                                            {status === 'generating' && <span className="text-blue-600 flex items-center gap-1 text-xs"><Loader2 size={12} className="animate-spin" /> 生成中</span>}
                                            {status === 'completed' && <span className="text-green-600 flex items-center gap-1 text-xs"><Check size={12} /> 完了</span>}
                                            {status === 'error' && <span className="text-red-500 flex items-center gap-1 text-xs"><AlertCircle size={12} /> エラー</span>}
                                        </td>
                                        <td className="px-4 py-3">
                                            {status === 'completed' && (
                                                <div className="text-xs text-slate-500 truncate max-w-[300px]" title={result.content}>
                                                    {result.content}
                                                </div>
                                            )}
                                            {status === 'error' && (
                                                <span className="text-xs text-red-500">{result.error}</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="flex justify-start mt-6">
                <button
                    onClick={() => setStep('upload')}
                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium text-sm"
                >
                    新しいファイルをアップロード
                </button>
            </div>
            <ProFeatureModal
                isOpen={showProModal}
                onClose={() => setShowProModal(false)}
                featureName="CSV一括生成機能"
            />
        </div>
    );
}


