'use client';

import { useEffect, useState, use } from 'react';
import { getBatchLetters } from '@/lib/supabaseHistoryUtils';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { LetterHistory } from '@/types/letter';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import { saveAs } from 'file-saver';

export default function BatchDetailPage({ params }: { params: Promise<{ batchId: string }> }) {
    const router = useRouter();
    const [letters, setLetters] = useState<LetterHistory[]>([]);
    const [loading, setLoading] = useState(true);
    const [batchId, setBatchId] = useState<string>('');

    // Unwrap params using React.use()
    const resolvedParams = use(params);

    useEffect(() => {
        if (resolvedParams.batchId) {
            setBatchId(resolvedParams.batchId);
            loadBatch(resolvedParams.batchId);
        }
    }, [resolvedParams]);

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

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 mb-2">一括生成結果詳細</h1>
                    <p className="text-slate-600">
                        生成日時: {letters.length > 0 ? new Date(letters[0].createdAt).toLocaleString('ja-JP') : '-'}
                        <span className="mx-2">|</span>
                        件数: {letters.length}件
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
                            {letters.map((letter) => (
                                <tr key={letter.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-slate-900">{letter.targetCompany}</div>
                                        <div>{letter.targetName} 様</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                            {letter.status || 'generated'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 max-w-md">
                                        <p className="line-clamp-2 text-slate-500">{letter.content}</p>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-2">
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
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
