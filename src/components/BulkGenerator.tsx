'use client';

import React, { useState } from 'react';
import Papa from 'papaparse';
import { Upload, Check, Play, Loader2, AlertCircle, ChevronDown, ChevronUp, FileSpreadsheet, Download, HelpCircle } from 'lucide-react';

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
}

const ALIASES = {
    companyName: ['会社名', '企業名', 'Company', '法人名', 'company'],
    name: ['氏名', '名前', '担当者名', 'Name', 'Full Name', 'name'],
    position: ['役職', '肩書き', 'Position', 'Title', 'position'],
    background: ['背景', '目的', 'Background', 'Context', 'background'],
    note: ['備考', 'Note', 'Memo', 'note'],
    url: ['URL', 'Webサイト', 'ホームページ', 'Website', 'url'],
    eventName: ['イベント名', 'Event Name', 'Event', 'event_name'],
    proposal: ['提案内容', 'Proposal', 'Topic', 'proposal', '件名']
};

interface GenerationStatus {
    index: number;
    status: 'pending' | 'generating' | 'completed' | 'error';
    content?: string;
    error?: string;
}

export function BulkGenerator() {
    const [step, setStep] = useState<Step>('upload');
    const [csvData, setCsvData] = useState<AnalyzedRow[]>([]);
    const [headers, setHeaders] = useState<string[]>([]);
    const [fileName, setFileName] = useState('');
    const [isGuideOpen, setIsGuideOpen] = useState(true);

    const handleDownloadTemplate = () => {
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
        myServiceDescription: ''
    });

    const [mapping, setMapping] = useState<MappingConfig>({
        companyName: '',
        name: '',
        position: '',
        background: '',
        note: '',
        url: '',
        eventName: '',
        proposal: ''
    });

    const [isGenerating, setIsGenerating] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0 });
    const [results, setResults] = useState<GenerationStatus[]>([]);

    // ---- Step 1: Upload & Parse ----
    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setFileName(file.name);
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

        setMapping(newMapping);
    };

    // ---- Step 2: Mapping ----
    const handleMappingChange = (key: keyof MappingConfig, value: string) => {
        setMapping(prev => ({ ...prev, [key]: value }));
    };

    const isMappingValid = () => {
        return mapping.companyName && mapping.name &&
            senderInfo.myCompanyName && senderInfo.myName && senderInfo.myServiceDescription;
    };

    // ---- Step 3: Execution ----
    const startGeneration = async () => {
        setIsGenerating(true);
        setStep('execution');

        // Validate inputs
        const validItems = csvData.filter(row => row[mapping.companyName] && row[mapping.name]);

        // Prepare items for API
        const items = validItems.map(row => ({
            companyName: row[mapping.companyName] || '',
            name: row[mapping.name] || '',
            position: mapping.position ? row[mapping.position] : '',
            background: mapping.background ? row[mapping.background] : '',
            note: mapping.note ? row[mapping.note] : '',
            url: mapping.url ? row[mapping.url] : '',
            eventName: mapping.eventName ? row[mapping.eventName] : '',
            proposal: mapping.proposal ? row[mapping.proposal] : ''
        }));

        setProgress({ current: 0, total: items.length });
        setResults(items.map((_, i) => ({ index: i, status: 'pending' })));

        try {
            const response = await fetch('/api/batch-generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    items,
                    myCompanyName: senderInfo.myCompanyName,
                    myName: senderInfo.myName,
                    myServiceDescription: senderInfo.myServiceDescription
                })
            });

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
                        }
                    } catch (e) {
                        console.error('JSON Parse error', e);
                    }
                }
            }
        } catch (error) {
            console.error('Generation Error', error);
            alert('生成中にエラーが発生しました。');
        } finally {
            setIsGenerating(false);
        }
    };


    // ---- Renderers ----

    if (step === 'upload') {
        return (
            <div className="max-w-2xl mx-auto bg-white p-8 rounded-xl shadow-sm border border-slate-200">
                <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                    <span className="bg-slate-100 text-slate-600 w-8 h-8 rounded-full flex items-center justify-center text-sm">1</span>
                    CSVファイルのアップロード
                </h2>

                <div className="border-2 border-dashed border-slate-300 rounded-lg p-12 text-center hover:bg-slate-50 transition-colors relative">
                    <input
                        type="file"
                        accept=".csv"
                        onChange={handleFileUpload}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <Upload className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                    <p className="text-slate-600 font-medium">CSVファイルをここにドラッグ&ドロップ</p>
                    <p className="text-slate-400 text-sm mt-2">または クリックしてファイルを選択</p>
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
                        <div className="space-y-1">
                            <label className="block text-sm font-bold text-slate-700">氏名 <span className="text-red-500">*</span></label>
                            <select
                                value={mapping.name}
                                onChange={(e) => handleMappingChange('name', e.target.value)}
                                className="w-full border border-slate-300 rounded-md p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                            >
                                <option value="">選択してください</option>
                                {headers.map(h => <option key={h} value={h}>{h}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="space-y-4">
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
                </div>

                <div className="bg-slate-50 p-4 rounded-lg mb-8">
                    <h3 className="text-sm font-bold text-slate-700 mb-2">プレビュー（最初の1件）</h3>
                    {csvData.length > 0 && (
                        <div className="text-sm text-slate-600 grid grid-cols-2 gap-2">
                            <div><span className="font-semibold">会社名:</span> {csvData[0][mapping.companyName] || '-'}</div>
                            <div><span className="font-semibold">氏名:</span> {csvData[0][mapping.name] || '-'}</div>
                        </div>
                    )}
                </div>

                {/* Sender Info Section */}
                <div className="bg-blue-50 p-6 rounded-lg border border-blue-100 mb-8">
                    <h3 className="text-md font-bold text-blue-800 mb-4">差出人情報（必須）</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">自社名</label>
                            <input
                                type="text"
                                value={senderInfo.myCompanyName}
                                onChange={(e) => setSenderInfo(p => ({ ...p, myCompanyName: e.target.value }))}
                                className="w-full border border-slate-300 rounded-md p-2"
                                placeholder="例: 株式会社Antigravity"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">差出人名</label>
                            <input
                                type="text"
                                value={senderInfo.myName}
                                onChange={(e) => setSenderInfo(p => ({ ...p, myName: e.target.value }))}
                                className="w-full border border-slate-300 rounded-md p-2"
                                placeholder="例: 佐藤 健太"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">自社サービス概要</label>
                        <textarea
                            value={senderInfo.myServiceDescription}
                            onChange={(e) => setSenderInfo(p => ({ ...p, myServiceDescription: e.target.value }))}
                            className="w-full border border-slate-300 rounded-md p-2"
                            rows={2}
                            placeholder="例: AIを活用した次世代の営業支援ツールを提供しています。"
                        />
                    </div>
                </div>

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
                        生成を開始する ({csvData.filter(r => r[mapping.companyName] && r[mapping.name]).length}件)
                    </button>
                </div>
            </div>
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

            <div className="w-full bg-slate-100 rounded-full h-2 mb-8 overflow-hidden">
                <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${(progress.current / progress.total) * 100}%` }}
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
        </div>
    );
}
