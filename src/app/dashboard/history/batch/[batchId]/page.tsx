'use client';

import { useEffect, useState, use } from 'react';
import { getBatchLetters } from '@/lib/supabaseHistoryUtils';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import type { LetterHistory } from '@/types/letter';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import { saveAs } from 'file-saver';
import { StatusDropdown } from '@/components/StatusDropdown';

export default function BatchDetailPage({ params }: { params: Promise<{ batchId: string }> }) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const shouldHighlight = searchParams.get('highlight') === 'true';

    const [letters, setLetters] = useState<LetterHistory[]>([]);
    const [loading, setLoading] = useState(true);
    const [batchId, setBatchId] = useState<string>('');
    const [showHighlight, setShowHighlight] = useState(shouldHighlight);

    // Unwrap params using React.use()
    const resolvedParams = use(params);

    useEffect(() => {
        if (resolvedParams.batchId) {
            setBatchId(resolvedParams.batchId);
            loadBatch(resolvedParams.batchId);
        }
    }, [resolvedParams]);

    // Auto-hide highlight after 5 seconds
    useEffect(() => {
        if (shouldHighlight) {
            const timer = setTimeout(() => {
                setShowHighlight(false);
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [shouldHighlight]);

    const loadBatch = async (id: string) => {
        try {
            setLoading(true);
            const data = await getBatchLetters(id);
            setLetters(data);
        } catch (error) {
            console.error('Failed to load batch:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCopy = async (content: string) => {
        try {
            await navigator.clipboard.writeText(content);
            alert('コピーしました');
        } catch (err) {
            console.error('Copy failed:', err);
        }
    };

    const handleDownloadWord = async (letter: LetterHistory) => {
        try {
            const paragraphs = letter.content.split('\n').map(
                (line) =>
                    new Paragraph({
                        children: [new TextRun(line)],
                        spacing: { after: 200 },
                    })
            );
            const doc = new Document({ sections: [{ children: paragraphs }] });
            const blob = await Packer.toBlob(doc);
            saveAs(blob, `${letter.targetCompany}_${letter.targetName}_letter.docx`);
        } catch (err) {
            console.error('Download failed:', err);
            alert('ダウンロードに失敗しました');
        }
    };

    const handleDownloadCSV = () => {
        if (letters.length === 0) return;

        // Header
        const headers = ['Company', 'Name', 'Content', 'Status', 'Created At'];
        const csvContent = [
            headers.join(','),
            ...letters.map(l => {
                const row = [
                    `"${l.targetCompany.replace(/"/g, '""')}"`,
                    `"${l.targetName.replace(/"/g, '""')}"`,
                    `"${l.content.replace(/"/g, '""')}"`,
                    l.status || 'generated',
                    l.createdAt
                ];
                return row.join(',');
            })
        ].join('\n');

        const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
        saveAs(blob, `batch_export_${batchId}.csv`);
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    return (
        <div>
            <div className="mb-6 flex items-center gap-4">
                <Link
                    href="/dashboard/history"
                    className="text-slate-500 hover:text-slate-700 transition-colors"
                >
                    ← 履歴一覧に戻る
                </Link>
            </div>

            {/* Highlight Banner */}
            {showHighlight && (
                <div className="mb-6 bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r-lg animate-pulse">
                    <div className="flex items-center gap-2">
                        <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-yellow-800 font-medium">新しく生成されたアイテムです</span>
                    </div>
                </div>
            )}

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 mb-2">一括生成結果詳細</h1>
                    <p className="text-slate-600">
                        生成日時: {letters.length > 0 ? new Date(letters[0].createdAt).toLocaleString('ja-JP') : '-'}
                        <span className="mx-2">|</span>
                        成功: {letters.filter(l => l.status !== 'failed').length}件
                        <span className="mx-2">|</span>
                        失敗: {letters.filter(l => l.status === 'failed').length}件
                    </p>
                </div>

                <button
                    onClick={handleDownloadCSV}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors shadow-sm font-medium"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    一括ダウンロード (CSV)
                </button>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-600">
                        <thead className="bg-slate-50 border-b border-slate-200 font-medium text-slate-900">
                            <tr>
                                <th className="px-6 py-4">企業名・氏名</th>
                                <th className="px-6 py-4">ステータス</th>
                                <th className="px-6 py-4">本文プレビュー</th>
                                <th className="px-6 py-4 text-right">アクション</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {letters.map((letter) => {
                                const isFailed = letter.status === 'failed';
                                const rowClasses = `transition-all duration-500 ${
                                    isFailed
                                        ? 'bg-red-50 hover:bg-red-100'
                                        : showHighlight
                                            ? 'bg-yellow-50 hover:bg-yellow-100'
                                            : 'hover:bg-slate-50'
                                }`;

                                return (
                                    <tr key={letter.id} className={rowClasses}>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <div>
                                                    <div className="font-bold text-slate-900">{letter.targetCompany}</div>
                                                    <div>{letter.targetName} 様</div>
                                                </div>
                                                {showHighlight && !isFailed && (
                                                    <span className="px-2 py-0.5 rounded text-xs font-bold bg-yellow-400 text-yellow-900 animate-pulse">
                                                        NEW
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <StatusDropdown
                                                letterId={letter.id}
                                                currentStatus={letter.status || 'generated'}
                                                onStatusChange={(newStatus) => {
                                                    setLetters(prev => prev.map(l =>
                                                        l.id === letter.id ? { ...l, status: newStatus } : l
                                                    ));
                                                }}
                                            />
                                        </td>
                                        <td className="px-6 py-4 max-w-md">
                                            <p className="line-clamp-2 text-slate-500">{letter.content || '（生成失敗）'}</p>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                {!isFailed && (
                                                    <>
                                                        <Link
                                                            href={`/new?restore=${letter.id}`}
                                                            className="px-3 py-1 bg-white border border-slate-200 rounded hover:bg-slate-50 text-slate-700 transition-colors"
                                                        >
                                                            詳細
                                                        </Link>
                                                        <button
                                                            onClick={() => handleCopy(letter.content)}
                                                            className="px-3 py-1 bg-white border border-slate-200 rounded hover:bg-slate-50 text-slate-700 transition-colors"
                                                        >
                                                            コピー
                                                        </button>
                                                        <button
                                                            onClick={() => handleDownloadWord(letter)}
                                                            className="px-3 py-1 bg-white border border-slate-200 rounded hover:bg-slate-50 text-slate-700 transition-colors"
                                                        >
                                                            Word
                                                        </button>
                                                    </>
                                                )}
                                                {isFailed && (
                                                    <span className="text-sm text-red-600">操作不可</span>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
