'use client';

import React, { useState } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { Upload, Check, Play, Loader2, AlertCircle, ChevronDown, ChevronUp, FileSpreadsheet, Download, HelpCircle, Wand2, RefreshCw } from 'lucide-react';
import { useUserPlan } from '@/hooks/useUserPlan';
import { getProfile } from '@/lib/profileUtils';
import { ProFeatureModal } from './ProFeatureModal';
import { useRouter } from 'next/navigation';

type Step = 'upload' | 'mapping' | 'execution';

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

    const [senderInfo, setSenderInfo] = useState({
        myCompanyName: '',
        myName: '',
        myDepartment: '',
        myServiceDescription: '',
        myPosition: ''
    });

    // Auto-fill profile on mount
    React.useEffect(() => {
        getProfile().then(profile => {
            if (profile) {
                setSenderInfo(prev => ({
                    ...prev,
                    myCompanyName: profile.company_name || '',
                    myName: profile.user_name || '',
                    myServiceDescription: profile.service_description || ''
                }));
            }
        });
    }, []);

    const [senderRule, setSenderRule] = useState<'csv_priority' | 'overwrite'>('csv_priority');
    const [nameMode, setNameMode] = useState<'full' | 'separate'>('full');
    const [aiUrl, setAiUrl] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    const handleUrlAnalysis = async () => {
        if (!aiUrl) return;
        setIsAnalyzing(true);
        try {
            const res = await fetch('/api/analyze-url', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: aiUrl })
            });
            const data = await res.json();
            if (data.success && data.data) {
                setSenderInfo(prev => ({
                    ...prev,
                    myCompanyName: data.data.companyName || prev.myCompanyName,
                    myName: data.data.personName || prev.myName,
                    myServiceDescription: data.data.summary || prev.myServiceDescription
                }));
            } else {
                alert('情報の取得に失敗しました: ' + (data.error || '不明なエラー'));
            }
        } catch (e) {
            console.error(e);
            alert('通信エラーが発生しました');
        } finally {
            setIsAnalyzing(false);
        }
    };

    // 生成オプション設定
    const [mediaType, setMediaType] = useState<'letter' | 'mail'>('letter');
    const [generationMode, setGenerationMode] = useState<'sales' | 'event'>('sales');

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

    const isMappingValid = () => {
        const nameValid = nameMode === 'full' ? mapping.name : (mapping.lastName && mapping.firstName);
        return mapping.companyName && nameValid &&
            senderInfo.myCompanyName && senderInfo.myName && senderInfo.myServiceDescription;
    };

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

            // Sender Logic
            if (senderRule === 'overwrite') {
                return {
                    ...baseItem,
                    senderName: senderInfo.myName,
                    senderCompany: senderInfo.myCompanyName,
                    senderDepartment: senderInfo.myDepartment,
                    senderPosition: senderInfo.myPosition
                };
            } else {
                return {
                    ...baseItem,
                    senderName: mapping.senderName ? row[mapping.senderName] : '',
                    senderCompany: mapping.senderCompany ? row[mapping.senderCompany] : '',
                    senderDepartment: mapping.senderDepartment ? row[mapping.senderDepartment] : '',
                    senderPosition: mapping.senderPosition ? row[mapping.senderPosition] : ''
                };
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
                    myServiceDescription: senderInfo.myServiceDescription,
                    output_format: mediaType === 'mail' ? 'email' : 'letter',
                    mode: generationMode
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

            if (!response.body) throw new Error('No response body');

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                // Keep the last partial line in the buffer
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (!line.trim()) continue;
                    try {
                        const msg = JSON.parse(line);

                        if (msg.type === 'progress') {
                            setResults(prev => {
                                const newResults = [...prev];
                                // Update the specific item status
                                if (newResults[msg.index]) {
                                    newResults[msg.index] = {
                                        index: msg.index,
                                        status: 'completed',
                                        content: msg.generatedContent
                                    };
                                }
                                return newResults;
                            });
                            // Update progress count
                            setProgress(p => ({ ...p, current: Math.min(p.current + 1, p.total) }));

                        } else if (msg.type === 'error') {
                            setResults(prev => {
                                const newResults = [...prev];
                                if (newResults[msg.index]) {
                                    newResults[msg.index] = {
                                        index: msg.index,
                                        status: 'error',
                                        error: msg.message
                                    };
                                }
                                return newResults;
                            });
                            // Update progress count for errors as well
                            setProgress(p => ({ ...p, current: Math.min(p.current + 1, p.total) }));
                        } else if (msg.type === 'done') {
                            // Store final statistics and batch ID
                            setStatistics({
                                successCount: msg.successCount || 0,
                                failureCount: msg.failureCount || 0
                            });
                            setCompletedBatchId(msg.batchId);

                            // Auto-redirect to batch detail page after 3 seconds
                            setTimeout(() => {
                                router.push(`/dashboard/history/batch/${msg.batchId}?highlight=true`);
                            }, 3000);
                        }
                    } catch (e) {
                        console.error('JSON Parse error', e);
                    }
                }
            }
        } catch (error) {
            console.error('Generation Error', error);
            const errorMsg = error instanceof Error ? error.message : '生成中にエラーが発生しました。';
            setErrorMessage(errorMsg);
            setIsGenerating(false);
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

                                        <div className="bg-purple-50 p-4 rounded-lg border border-purple-100 flex flex-col md:flex-row md:items-start gap-3">
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
        return (
            <div className="max-w-3xl mx-auto bg-white p-8 rounded-xl shadow-sm border border-slate-200">
                <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                    <span className="bg-slate-100 text-slate-600 w-8 h-8 rounded-full flex items-center justify-center text-sm">2</span>
                    データのマッピング
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
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

                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                            <div className="flex items-center justify-between mb-2">
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
                                    <div>
                                        <span className="text-xs text-slate-500 block mb-1">姓 (Last)</span>
                                        <select
                                            value={mapping.lastName}
                                            onChange={(e) => handleMappingChange('lastName', e.target.value)}
                                            className="w-full border border-slate-300 rounded-md p-2 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                                        >
                                            <option value="">選択</option>
                                            {headers.map(h => <option key={h} value={h}>{h}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <span className="text-xs text-slate-500 block mb-1">名 (First)</span>
                                        <select
                                            value={mapping.firstName}
                                            onChange={(e) => handleMappingChange('firstName', e.target.value)}
                                            className="w-full border border-slate-300 rounded-md p-2 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                                        >
                                            <option value="">選択</option>
                                            {headers.map(h => <option key={h} value={h}>{h}</option>)}
                                        </select>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-1">
                            <label className="block text-sm font-medium text-slate-700">部署名</label>
                            <select
                                value={mapping.recipientDepartment}
                                onChange={(e) => handleMappingChange('recipientDepartment', e.target.value)}
                                className="w-full border border-slate-300 rounded-md p-2 outline-none"
                            >
                                <option value="">（使用しない）</option>
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
                                <option value="">（使用しない）</option>
                                {headers.map(h => <option key={h} value={h}>{h}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="block text-sm font-medium text-slate-700">背景・目的</label>
                            <select
                                value={mapping.background}
                                onChange={(e) => handleMappingChange('background', e.target.value)}
                                className="w-full border border-slate-300 rounded-md p-2 outline-none"
                            >
                                <option value="">（使用しない）</option>
                                {headers.map(h => <option key={h} value={h}>{h}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="block text-sm font-medium text-slate-700">備考</label>
                            <select
                                value={mapping.note}
                                onChange={(e) => handleMappingChange('note', e.target.value)}
                                className="w-full border border-slate-300 rounded-md p-2 outline-none"
                            >
                                <option value="">（使用しない）</option>
                                {headers.map(h => <option key={h} value={h}>{h}</option>)}
                            </select>
                        </div>

                        <div className="space-y-1">
                            <label className="block text-sm font-medium text-slate-700">URL（AI分析用）</label>
                            <select
                                value={mapping.url}
                                onChange={(e) => handleMappingChange('url', e.target.value)}
                                className="w-full border border-slate-300 rounded-md p-2 outline-none"
                            >
                                <option value="">（使用しない）</option>
                                {headers.map(h => <option key={h} value={h}>{h}</option>)}
                            </select>
                        </div>

                        {/* Sender Fields Mapping (Optional) */}
                        <div className="pt-4 mt-4 border-t border-slate-200">
                            <p className="text-xs text-slate-500 font-bold mb-2">▼ 差出人情報の個別指定 (必要な場合のみ)</p>
                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <label className="block text-sm font-medium text-slate-700">差出人名</label>
                                    <select
                                        value={mapping.senderName}
                                        onChange={(e) => handleMappingChange('senderName', e.target.value)}
                                        className="w-full border border-slate-300 rounded-md p-2 outline-none"
                                    >
                                        <option value="">（デフォルトを使用）</option>
                                        {headers.map(h => <option key={h} value={h}>{h}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="block text-sm font-medium text-slate-700">差出人会社名</label>
                                    <select
                                        value={mapping.senderCompany}
                                        onChange={(e) => handleMappingChange('senderCompany', e.target.value)}
                                        className="w-full border border-slate-300 rounded-md p-2 outline-none"
                                    >
                                        <option value="">（デフォルトを使用）</option>
                                        {headers.map(h => <option key={h} value={h}>{h}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="block text-sm font-medium text-slate-700">差出人部署</label>
                                    <select
                                        value={mapping.senderDepartment}
                                        onChange={(e) => handleMappingChange('senderDepartment', e.target.value)}
                                        className="w-full border border-slate-300 rounded-md p-2 outline-none"
                                    >
                                        <option value="">（デフォルトを使用）</option>
                                        {headers.map(h => <option key={h} value={h}>{h}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="block text-sm font-medium text-slate-700">差出人役職</label>
                                <select
                                    value={mapping.senderPosition}
                                    onChange={(e) => handleMappingChange('senderPosition', e.target.value)}
                                    className="w-full border border-slate-300 rounded-md p-2 outline-none"
                                >
                                    <option value="">（使用しない）</option>
                                    {headers.map(h => <option key={h} value={h}>{h}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="pt-4 mt-4 border-t border-slate-200">
                        <p className="text-xs text-slate-500 font-bold mb-2">▼ モード自動切替用（いずれか選択）</p>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="block text-sm font-medium text-blue-800">提案内容 (Sales)</label>
                                <select
                                    value={mapping.proposal}
                                    onChange={(e) => handleMappingChange('proposal', e.target.value)}
                                    className="w-full border border-blue-200 bg-blue-50 rounded-md p-2 outline-none focus:ring-1 focus:ring-blue-500"
                                >
                                    <option value="">（使用しない）</option>
                                    {headers.map(h => <option key={h} value={h}>{h}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="block text-sm font-medium text-purple-800">イベント名 (Invite)</label>
                                <select
                                    value={mapping.eventName}
                                    onChange={(e) => handleMappingChange('eventName', e.target.value)}
                                    className="w-full border border-purple-200 bg-purple-50 rounded-md p-2 outline-none focus:ring-1 focus:ring-purple-500"
                                >
                                    <option value="">（使用しない）</option>
                                    {headers.map(h => <option key={h} value={h}>{h}</option>)}
                                </select>
                            </div>

                        </div>
                    </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-lg mb-8">
                    <h3 className="text-sm font-bold text-slate-700 mb-2">プレビュー（最初の1件）</h3>
                    {csvData.length > 0 && (
                        <div className="text-sm text-slate-600 grid grid-cols-2 gap-2">
                            <div><span className="font-semibold">会社名:</span> {csvData[0][mapping.companyName] || '-'}</div>
                            <div>
                                <span className="font-semibold">氏名:</span> {
                                    nameMode === 'full'
                                        ? (csvData[0][mapping.name] || '-')
                                        : `${csvData[0][mapping.lastName] || ''} ${csvData[0][mapping.firstName] || ''}`
                                }
                            </div>
                        </div>
                    )}
                </div>

                {/* Sender Info Section was moved to Step 1 */}
                <div className="flex justify-end gap-3">
                    <button
                        onClick={() => setStep('upload')}
                        className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                    >
                        戻る
                    </button>
                    <button
                        onClick={startGeneration}
                        disabled={!isMappingValid()}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        <Play size={18} />
                        生成を開始する ({csvData.filter(r => {
                            const hasCompany = !!r[mapping.companyName];
                            const hasName = nameMode === 'full' ? !!r[mapping.name] : (!!r[mapping.lastName] && !!r[mapping.firstName]);
                            return hasCompany && hasName;
                        }).length}件)
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
                <div className="text-sm font-medium text-slate-600">
                    {progress.current} / {progress.total} 件完了
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
                                        onClick={() => router.push('/dashboard/pricing')}
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

                    {/* Redirect Notice */}
                    {completedBatchId && (
                        <div className="mb-8 bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                            <div className="flex items-center justify-center gap-2 text-blue-900">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span className="font-medium">3秒後に結果詳細ページへ自動移動します...</span>
                            </div>
                        </div>
                    )}
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
        </div>
    );
}
