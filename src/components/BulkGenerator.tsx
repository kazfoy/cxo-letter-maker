'use client';

import React, { useState } from 'react';
import Papa from 'papaparse';
import { v4 as uuidv4 } from 'uuid';
import { useRouter } from 'next/navigation';

interface CSVRow {
    [key: string]: string;
}

export function BulkGenerator() {
    const router = useRouter();
    const [step, setStep] = useState<'upload' | 'mapping' | 'common' | 'processing' | 'complete'>('upload');
    const [csvData, setCsvData] = useState<CSVRow[]>([]);
    const [headers, setHeaders] = useState<string[]>([]);
    const [previewData, setPreviewData] = useState<CSVRow[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [mapping, setMapping] = useState({
        companyName: '',
        name: '',
        position: '',
        purpose: '',
        note: '',
    });
    const [commonData, setCommonData] = useState({
        myCompanyName: '',
        myName: '',
        myServiceDescription: '',
        problem: '',
        solution: '',
        caseStudy: '',
        offer: '',
    });
    const [progress, setProgress] = useState({ current: 0, total: 0, success: 0, failed: 0 });
    const [isProcessing, setIsProcessing] = useState(false);

    // Auto-mapping helper: CSVヘッダーとマッピングキーの一致を試みる
    const autoMapHeaders = (headerList: string[]) => {
        const newMapping = { ...mapping };
        const mappingRules: Record<keyof typeof mapping, string[]> = {
            companyName: ['会社名', '企業名', 'company', 'companyname'],
            name: ['氏名', '名前', 'name', 'お名前'],
            position: ['役職', 'position', '肩書'],
            purpose: ['目的', '背景', 'purpose', '目的・背景'],
            note: ['備考', 'note', 'メモ', 'memo'],
        };

        Object.entries(mappingRules).forEach(([key, patterns]) => {
            const matched = headerList.find(h =>
                patterns.some(p => h.toLowerCase().includes(p.toLowerCase()))
            );
            if (matched) {
                newMapping[key as keyof typeof mapping] = matched;
            }
        });

        return newMapping;
    };

    // 1. CSV Upload Handler
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        processCSVFile(file);
    };

    // Drag and Drop handlers
    const handleDragEnter = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        const file = e.dataTransfer.files?.[0];
        if (file && file.type === 'text/csv') {
            processCSVFile(file);
        } else {
            alert('CSVファイルのみアップロード可能です');
        }
    };

    // CSV file processing logic
    const processCSVFile = (file: File) => {
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                const data = results.data as CSVRow[];
                const headerList = results.meta.fields || [];

                setCsvData(data);
                setHeaders(headerList);
                setPreviewData(data.slice(0, 5)); // 最初の5行をプレビュー用に保存

                // 自動マッピングを試みる
                const autoMapped = autoMapHeaders(headerList);
                setMapping(autoMapped);

                setStep('mapping');
            },
            error: (error) => {
                console.error('CSV Parse Error:', error);
                alert('CSVの読み込みに失敗しました');
            }
        });
    };

    // 2. Mapping Handler
    const handleMappingChange = (field: keyof typeof mapping, value: string) => {
        setMapping(prev => ({ ...prev, [field]: value }));
    };

    // 3. Common Data Handler
    const handleCommonDataChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setCommonData(prev => ({ ...prev, [name]: value }));
    };

    // 4. Batch Processing
    const startBatchGeneration = async () => {
        if (!mapping.companyName || !mapping.name) {
            alert('必須項目（会社名、氏名）のマッピングを行ってください');
            return;
        }

        setStep('processing');
        setIsProcessing(true);
        const batchId = uuidv4();
        const total = csvData.length;
        setProgress({ current: 0, total, success: 0, failed: 0 });

        for (let i = 0; i < total; i++) {
            const row = csvData[i];
            const rowData = {
                companyName: row[mapping.companyName] || '',
                name: row[mapping.name] || '',
                position: mapping.position ? row[mapping.position] || '' : '',
                purpose: mapping.purpose ? row[mapping.purpose] || '' : '',
                note: mapping.note ? row[mapping.note] || '' : '',
            };

            // Skip empty rows
            if (!rowData.companyName || !rowData.name) {
                setProgress(prev => ({ ...prev, current: prev.current + 1, failed: prev.failed + 1 }));
                continue;
            }

            try {
                const response = await fetch('/api/batch-generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        batchId,
                        rowData,
                        commonData,
                    }),
                });

                if (response.ok) {
                    setProgress(prev => ({ ...prev, current: prev.current + 1, success: prev.success + 1 }));
                } else {
                    console.error(`Failed row ${i}:`, await response.text());
                    setProgress(prev => ({ ...prev, current: prev.current + 1, failed: prev.failed + 1 }));
                }
            } catch (error) {
                console.error(`Error row ${i}:`, error);
                setProgress(prev => ({ ...prev, current: prev.current + 1, failed: prev.failed + 1 }));
            }

            // Rate limiting / gentle pacing
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        setIsProcessing(false);
        setStep('complete');
    };

    return (
        <div className="max-w-4xl mx-auto p-6 bg-white rounded-xl shadow-sm border border-slate-200">
            <h2 className="text-2xl font-bold text-slate-900 mb-6">CSV一括生成 (Beta)</h2>

            {/* Step 1: Upload */}
            {step === 'upload' && (
                <div>
                    <div
                        className={`text-center py-12 border-2 border-dashed rounded-lg transition-colors ${
                            isDragging
                                ? 'border-indigo-500 bg-indigo-50'
                                : 'border-slate-300 bg-slate-50'
                        }`}
                        onDragEnter={handleDragEnter}
                        onDragLeave={handleDragLeave}
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                    >
                        <input
                            type="file"
                            accept=".csv"
                            onChange={handleFileUpload}
                            className="hidden"
                            id="csv-upload"
                        />
                        <div className="mb-4">
                            <svg className="mx-auto h-12 w-12 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                        </div>
                        <label
                            htmlFor="csv-upload"
                            className="cursor-pointer inline-block bg-indigo-600 text-white px-6 py-3 rounded-md font-medium hover:bg-indigo-700 transition-colors"
                        >
                            CSVファイルを選択
                        </label>
                        <p className="mt-4 text-slate-500 text-sm">
                            またはファイルをここにドラッグ＆ドロップ
                        </p>
                        <p className="mt-2 text-slate-500 text-sm">
                            ヘッダー行を含むCSVファイルをアップロードしてください。<br />
                            必須項目: 会社名, 氏名
                        </p>
                    </div>
                </div>
            )}

            {/* Step 2: Mapping */}
            {step === 'mapping' && (
                <div className="space-y-6">
                    <h3 className="text-lg font-semibold border-b pb-2">列のマッピング</h3>
                    <p className="text-sm text-slate-600">CSVのどの列を各項目に使用するか選択してください。</p>

                    {/* CSV Preview */}
                    {previewData.length > 0 && (
                        <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                            <h4 className="text-sm font-semibold text-slate-700 mb-2">プレビュー（最初の{previewData.length}行）</h4>
                            <div className="overflow-x-auto">
                                <table className="min-w-full text-xs border-collapse">
                                    <thead>
                                        <tr className="bg-slate-200">
                                            {headers.map((header, idx) => (
                                                <th key={idx} className="border border-slate-300 px-2 py-1 text-left font-medium">
                                                    {header}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {previewData.map((row, rowIdx) => (
                                            <tr key={rowIdx} className="bg-white hover:bg-slate-50">
                                                {headers.map((header, colIdx) => (
                                                    <td key={colIdx} className="border border-slate-300 px-2 py-1">
                                                        {row[header] || '-'}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">会社名 (必須)</label>
                            <select
                                value={mapping.companyName}
                                onChange={(e) => handleMappingChange('companyName', e.target.value)}
                                className="w-full border border-slate-300 rounded-md p-2"
                            >
                                <option value="">選択してください</option>
                                {headers.map(h => <option key={h} value={h}>{h}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">氏名 (必須)</label>
                            <select
                                value={mapping.name}
                                onChange={(e) => handleMappingChange('name', e.target.value)}
                                className="w-full border border-slate-300 rounded-md p-2"
                            >
                                <option value="">選択してください</option>
                                {headers.map(h => <option key={h} value={h}>{h}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">役職 (推奨)</label>
                            <select
                                value={mapping.position}
                                onChange={(e) => handleMappingChange('position', e.target.value)}
                                className="w-full border border-slate-300 rounded-md p-2"
                            >
                                <option value="">選択してください</option>
                                {headers.map(h => <option key={h} value={h}>{h}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">目的・背景 (推奨)</label>
                            <select
                                value={mapping.purpose}
                                onChange={(e) => handleMappingChange('purpose', e.target.value)}
                                className="w-full border border-slate-300 rounded-md p-2"
                            >
                                <option value="">選択してください</option>
                                {headers.map(h => <option key={h} value={h}>{h}</option>)}
                            </select>
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-slate-700 mb-1">備考 (推奨)</label>
                            <select
                                value={mapping.note}
                                onChange={(e) => handleMappingChange('note', e.target.value)}
                                className="w-full border border-slate-300 rounded-md p-2"
                            >
                                <option value="">選択してください</option>
                                {headers.map(h => <option key={h} value={h}>{h}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                        <button onClick={() => setStep('upload')} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded">戻る</button>
                        <button
                            onClick={() => setStep('common')}
                            disabled={!mapping.companyName || !mapping.name}
                            className="px-6 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
                        >
                            次へ
                        </button>
                    </div>
                </div>
            )}

            {/* Step 3: Common Data */}
            {step === 'common' && (
                <div className="space-y-6">
                    <h3 className="text-lg font-semibold border-b pb-2">共通情報の入力</h3>
                    <p className="text-sm text-slate-600">すべての手紙に共通する自社情報や提案内容を入力してください。</p>

                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <input
                                name="myCompanyName"
                                placeholder="自社名 (必須)"
                                value={commonData.myCompanyName}
                                onChange={handleCommonDataChange}
                                className="border p-2 rounded"
                            />
                            <input
                                name="myName"
                                placeholder="担当者名 (必須)"
                                value={commonData.myName}
                                onChange={handleCommonDataChange}
                                className="border p-2 rounded"
                            />
                        </div>
                        <textarea
                            name="myServiceDescription"
                            placeholder="自社サービス概要 (必須)"
                            value={commonData.myServiceDescription}
                            onChange={handleCommonDataChange}
                            rows={3}
                            className="w-full border p-2 rounded"
                        />
                        <textarea
                            name="problem"
                            placeholder="課題 (共通)"
                            value={commonData.problem}
                            onChange={handleCommonDataChange}
                            rows={2}
                            className="w-full border p-2 rounded"
                        />
                        <textarea
                            name="solution"
                            placeholder="解決策 (共通)"
                            value={commonData.solution}
                            onChange={handleCommonDataChange}
                            rows={2}
                            className="w-full border p-2 rounded"
                        />
                        <textarea
                            name="offer"
                            placeholder="オファー (共通)"
                            value={commonData.offer}
                            onChange={handleCommonDataChange}
                            rows={2}
                            className="w-full border p-2 rounded"
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                        <button onClick={() => setStep('mapping')} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded">戻る</button>
                        <button
                            onClick={startBatchGeneration}
                            disabled={!commonData.myCompanyName || !commonData.myName || !commonData.myServiceDescription}
                            className="px-6 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
                        >
                            生成開始
                        </button>
                    </div>
                </div>
            )}

            {/* Step 4: Processing */}
            {step === 'processing' && (
                <div className="text-center py-12">
                    <h3 className="text-xl font-bold mb-4">生成中...</h3>
                    <div className="w-full bg-gray-200 rounded-full h-4 mb-4 overflow-hidden">
                        <div
                            className="bg-indigo-600 h-4 rounded-full transition-all duration-300"
                            style={{ width: `${(progress.current / progress.total) * 100}%` }}
                        ></div>
                    </div>
                    <p className="text-lg">
                        {progress.current} / {progress.total} 件完了
                    </p>
                    <div className="flex justify-center gap-6 mt-4 text-sm">
                        <span className="text-green-600 font-medium">成功: {progress.success}</span>
                        <span className="text-red-600 font-medium">失敗: {progress.failed}</span>
                    </div>
                    <p className="mt-8 text-slate-500 text-sm">
                        ブラウザを閉じないでください。処理には時間がかかる場合があります。
                    </p>
                </div>
            )}

            {/* Step 5: Complete */}
            {step === 'complete' && (
                <div className="text-center py-12">
                    <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <h3 className="text-2xl font-bold text-slate-900 mb-2">生成完了</h3>
                    <p className="text-slate-600 mb-8">
                        {progress.total}件中 {progress.success}件の生成に成功しました。
                    </p>
                    <div className="flex justify-center gap-4">
                        <button
                            onClick={() => setStep('upload')}
                            className="px-6 py-2 border border-slate-300 rounded hover:bg-slate-50"
                        >
                            続けて生成
                        </button>
                        <button
                            onClick={() => router.push('/new')} // TODO: 履歴ページができたらそちらへ
                            className="px-6 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
                        >
                            履歴を確認
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
