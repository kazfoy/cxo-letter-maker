'use client';

import React, { useState } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { Upload, Check, Play, Loader2, AlertCircle, ChevronDown, ChevronUp, FileSpreadsheet, Download, HelpCircle, Wand2, RefreshCw, CheckCircle2, ArrowRight, RotateCcw } from 'lucide-react';
import { useUserPlan } from '@/hooks/useUserPlan';
import { getProfile } from '@/lib/profileUtils';
import { ProFeatureModal } from './ProFeatureModal';
import Link from 'next/link'; // Added Link import

type Step = 'upload' | 'mapping' | 'execution';
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

// Success Modal Component
const SuccessModal = ({
    batchId,
    onClose,
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
                body: JSON.stringify({ url: aiUrl }),
            });

            if (!response.ok) throw new Error('Analysis failed');

            const data = await response.json();
            setSenderInfo(prev => ({
                ...prev,
                myCompanyName: data.companyName || prev.myCompanyName,
                myServiceDescription: data.description || data.summary || prev.myServiceDescription,
                myName: data.personName || prev.myName, // Added personName mapping
            }));
        } catch (error) {
            console.error('URL analysis error:', error);
            alert('URLの分析に失敗しました。');
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
                    myDepartment: (profile as any).department || '', // Temporary cast or fix type later
                    myPosition: (profile as any).position || ''
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
    const [isCancelling, setIsCancelling] = useState(false);
    const [currentBatchId, setCurrentBatchId] = useState<string | null>(null);
    const [progress, setProgress] = useState({ current: 0, total: 0 });
    const [results, setResults] = useState<GenerationStatus[]>([]);
    const [statistics, setStatistics] = useState({ successCount: 0, failureCount: 0 });
    const [completedBatchId, setCompletedBatchId] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [usageInfo, setUsageInfo] = useState<{
        usedToday: number;
        dailyLimit: number;
        remaining: number;
        userPlan: string;
    } | null>(null);
    const [showSuccessModal, setShowSuccessModal] = useState(false); // New state for success modal

    // Cancel generation handler
    const handleCancelGeneration = async () => {
        if (!currentBatchId || isCancelling) return;
        setIsCancelling(true);
        try {
            const response = await fetch(`/api/batch-jobs/${currentBatchId}/cancel`, {
                method: 'POST'
            });
            if (response.ok) {
                setErrorMessage('生成を中断しました');
            }
        } catch (error) {
            console.error('Cancel error:', error);
        } finally {
            setIsCancelling(false);
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

    // isMappingValid is kept for backward compatibility but internally uses getValidationErrors
    const isMappingValid = React.useCallback(() => {
        const errors = getValidationErrors();
        if (errors.length > 0) {
            console.log('[Validation Debug] Failed. Missing:', errors);
            return false;
        }
        console.log('[Validation Debug] Passed!');
        return true;
    }, [getValidationErrors]);

    // ---- Step 3: Execution ----
    const startGeneration = async () => {
        if (!checkProAccess()) return;

        setIsGenerating(true);
        setStep('execution');
        setErrorMessage(null); // Clear previous errors
        setUsageInfo(null);

        // Validate inputs
        const validItems = csvData.filter(row => {
            const hasCompany = !!row[mapping.companyName];
            const hasName = nameMode === 'full'
                ? !!row[mapping.name]
                : (!!row[mapping.lastName] && !!row[mapping.firstName]);
            return hasCompany && hasName;
        });

        // Prepare items for API
        const items = validItems.map(row => {
            // Name Construction
            const fullName = nameMode === 'full'
                ? (row[mapping.name] || '')
                : `${row[mapping.lastName] || ''} ${row[mapping.firstName] || ''}`.trim();

            const baseItem = {
                companyName: row[mapping.companyName] || '',
                name: fullName,
                position: mapping.position ? row[mapping.position] : '',
                department: mapping.recipientDepartment ? row[mapping.recipientDepartment] : '',
                background: mapping.background ? row[mapping.background] : '',
                note: mapping.note ? row[mapping.note] : '',
                url: mapping.url ? row[mapping.url] : '',
                eventName: mapping.eventName ? row[mapping.eventName] : '',
                proposal: mapping.proposal ? row[mapping.proposal] : '',
            };

            // Sender Logic: 'direct' mode uses form input, 'csv_priority' uses CSV columns, 'default' uses profile (handled by backend)
            if (senderRule === 'direct') {
                return {
                    ...baseItem,
                    senderName: senderInfo.myName,
                    senderCompany: senderInfo.myCompanyName,
                    senderDepartment: senderInfo.myDepartment || '',
                    senderPosition: senderInfo.myPosition || ''
                };
            } else if (senderRule === 'csv_priority') {
                return {
                    ...baseItem,
                    senderName: mapping.senderName ? row[mapping.senderName] : '',
                    senderCompany: mapping.senderCompany ? row[mapping.senderCompany] : '',
                    senderDepartment: mapping.senderDepartment ? row[mapping.senderDepartment] : '',
                    senderPosition: mapping.senderPosition ? row[mapping.senderPosition] : ''
                };
            } else {
                // 'default' mode: backend will use profile data
                return baseItem;
            }
        });

        setProgress({ current: 0, total: items.length });
        setResults(items.map((_, i) => ({ index: i, status: 'pending' })));

        try {
            const response = await fetch('/api/batch-generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    items,
                    myCompanyName: senderInfo.myCompanyName,
                    myDepartment: senderInfo.myDepartment,
                    myName: senderInfo.myName,
                    myPosition: senderInfo.myPosition,
                    myServiceDescription: senderInfo.myServiceDescription,
                    output_format: mediaType === 'mail' ? 'email' : 'letter',
                    mode: generationMode,
                    senderMode: senderRule  // Map frontend 'senderRule' to backend 'senderMode'
                })
            });

            // 日次制限エラーのチェック
            if (!response.ok) {
                const errorData = await response.json();
                setErrorMessage(errorData.error || '生成に失敗しました');
                if (errorData.usage) {
                    setUsageInfo(errorData.usage);
                }
                setIsGenerating(false);
                return; // Stop execution
            }

            const data = await response.json();
            const batchId = data.batchId;

            // Show success modal instead of auto-redirect
            setCompletedBatchId(batchId);
            setShowSuccessModal(true);
            setIsGenerating(false);

        } catch (error) {
            console.error('Generation Error', error);
            const errorMsg = error instanceof Error ? error.message : '生成中にエラーが発生しました。';
            setErrorMessage(errorMsg);
            setIsGenerating(false);
        }
    };

    const handleReset = () => {
        setCsvData([]); // Changed from setItems to setCsvData
        // setCsvFile(null); // This state variable doesn't exist in the provided code
        setResults([]);
        setErrorMessage(null);
        setStatistics({ successCount: 0, failureCount: 0 }); // Changed from setStatistics(null)
        setShowSuccessModal(false);
        setCompletedBatchId(null);
        setStep('upload'); // Reset to upload step

        // Reset file input if exists
        const fileInput = document.getElementById('file-upload') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
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

                {/* Footer Action */}
                <div className="mt-8 flex justify-center pt-6 border-t border-slate-200 relative">
                    <button
                        onClick={startGeneration}
                        disabled={getValidationErrors().length > 0 || isGenerating}
                        className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold py-4 px-12 rounded-full shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all text-lg flex items-center gap-2 disabled:opacity-50 disabled:transform-none disabled:shadow-none"
                    >
                        {isGenerating ? (
                            <>
                                <Loader2 className="w-6 h-6 animate-spin" />
                                生成準備中...
                            </>
                        ) : (
                            <>
                                <Play className="w-6 h-6 fill-current" />
                                一括生成を開始する
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

    // Execution Step
    return (
        <div className="max-w-4xl mx-auto bg-white p-8 rounded-xl shadow-sm border border-slate-200">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    <span className="bg-slate-100 text-slate-600 w-8 h-8 rounded-full flex items-center justify-center text-sm">3</span>
                    生成進捗
                </h2>
                <div className="flex items-center gap-4">
                    <div className="text-sm font-medium text-slate-600">
                        {progress.current} / {progress.total} 件完了
                    </div>
                    {isGenerating && (
                        <button
                            onClick={handleCancelGeneration}
                            disabled={isCancelling}
                            className="px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 font-medium flex items-center gap-2 disabled:opacity-50"
                        >
                            {isCancelling ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    中断中...
                                </>
                            ) : (
                                <>
                                    <AlertCircle className="w-4 h-4" />
                                    中断する
                                </>
                            )}
                        </button>
                    )}
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
                                        onClick={() => { /* router.push('/dashboard/pricing') */ }} // Removed router.push
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
                    style={{ width: `${(progress.current / progress.total) * 100}%` }}
                />
            </div>

            {/* Statistics Summary */}
            {!isGenerating && progress.current === progress.total && progress.total > 0 && (
                <>
                    <div className="mb-6 grid grid-cols-2 gap-4">
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                            <div className="flex items-center gap-2">
                                <Check className="w-5 h-5 text-green-600" />
                                <div>
                                    <div className="text-sm text-green-700 font-medium">成功</div>
                                    <div className="text-2xl font-bold text-green-900">{statistics.successCount}件</div>
                                </div>
                            </div>
                        </div>
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                            <div className="flex items-center gap-2">
                                <AlertCircle className="w-5 h-5 text-red-600" />
                                <div>
                                    <div className="text-sm text-red-700 font-medium">失敗</div>
                                    <div className="text-2xl font-bold text-red-900">{statistics.failureCount}件</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Removed Redirect Notice */}
                </>
            )}

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

            {showSuccessModal && completedBatchId && (
                <SuccessModal
                    batchId={completedBatchId}
                    onClose={() => setShowSuccessModal(false)}
                    onReset={handleReset}
                />
            )}
        </div>
    );
}
