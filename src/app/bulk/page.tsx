import { BulkGenerator } from '@/components/BulkGenerator';
import { Header } from '@/components/Header';

export default function BulkPage() {
    return (
        <div className="min-h-screen bg-slate-50">
            <Header />
            <main className="container mx-auto px-4 py-8">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-slate-900">一括生成ツール</h1>
                    <p className="text-slate-600 mt-2">
                        CSVファイルをアップロードして、複数の宛先への手紙をまとめて生成します。
                    </p>
                </div>
                <BulkGenerator />
            </main>
        </div>
    );
}
