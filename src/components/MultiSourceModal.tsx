import { useState, useEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

// PDF.js workerの設定
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
}

interface MultiSourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAnalyze: (urls: string[], pdfText: string | null) => Promise<void>;
  type: 'own' | 'target';
  isAnalyzing: boolean;
}

export function MultiSourceModal({
  isOpen,
  onClose,
  onAnalyze,
  type,
  isAnalyzing,
}: MultiSourceModalProps) {
  const [urls, setUrls] = useState<string[]>(['']);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfText, setPdfText] = useState<string | null>(null);
  const [isExtractingPdf, setIsExtractingPdf] = useState(false);

  // モーダルが開いたときにリセット
  useEffect(() => {
    if (isOpen) {
      setUrls(['']);
      setPdfFile(null);
      setPdfText(null);
    }
  }, [isOpen]);

  const addUrl = () => {
    if (urls.length < 5) {
      setUrls([...urls, '']);
    }
  };

  const removeUrl = (index: number) => {
    if (urls.length > 1) {
      setUrls(urls.filter((_, i) => i !== index));
    }
  };

  const handleUrlChange = (index: number, value: string) => {
    const newUrls = [...urls];
    newUrls[index] = value;
    setUrls(newUrls);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;

    if (!file) {
      setPdfFile(null);
      setPdfText(null);
      return;
    }

    // ファイルサイズチェック（10MB）
    if (file.size > 10 * 1024 * 1024) {
      alert('PDFファイルは10MB以下にしてください');
      e.target.value = '';
      return;
    }

    // ファイルタイプチェック
    if (!file.type.includes('pdf') && !file.name.endsWith('.pdf')) {
      alert('PDFファイルのみアップロード可能です');
      e.target.value = '';
      return;
    }

    setPdfFile(file);

    // PDFからテキスト抽出
    setIsExtractingPdf(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;

      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ');
        fullText += pageText + ' ';
      }

      setPdfText(fullText.trim());
    } catch (error) {
      console.error('PDF extraction error:', error);
      alert('PDFの読み込みに失敗しました。別のファイルを試してください。');
      setPdfFile(null);
      setPdfText(null);
      e.target.value = '';
    } finally {
      setIsExtractingPdf(false);
    }
  };

  const handleAnalyze = () => {
    const validUrls = urls.filter(u => u.trim() !== '');

    // バリデーション
    if (validUrls.length === 0 && !pdfText) {
      alert('URLまたはPDFファイルを入力してください');
      return;
    }

    // URL形式の簡易チェック
    const invalidUrls = validUrls.filter(
      url => !url.startsWith('http://') && !url.startsWith('https://')
    );
    if (invalidUrls.length > 0) {
      alert('無効なURL形式があります。http:// または https:// で始まるURLを入力してください');
      return;
    }

    onAnalyze(validUrls, pdfText);
  };

  const hasValidUrl = urls.some(u => u.trim() !== '');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-lg w-full max-h-[80vh] overflow-hidden flex flex-col">
        {/* ヘッダー */}
        <div className="p-4 border-b flex justify-between items-center">
          <h3 className="text-lg font-semibold">
            {type === 'own' ? '自社情報' : 'ターゲット情報'}を複数ソースから入力
          </h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
            aria-label="閉じる"
            disabled={isAnalyzing}
          >
            ✕
          </button>
        </div>

        {/* ボディ - スクロール可能 */}
        <div className="overflow-y-auto flex-1 p-4 space-y-4">
          {/* URL入力セクション */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              URL（最大5件）
            </label>
            <div className="space-y-2">
              {urls.map((url, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => handleUrlChange(index, e.target.value)}
                    placeholder={`https://example.com ${index > 0 ? `(オプション ${index})` : ''}`}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={isAnalyzing}
                  />
                  {urls.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeUrl(index)}
                      className="px-3 py-2 bg-red-100 text-red-600 rounded-md hover:bg-red-200 transition-colors disabled:opacity-50"
                      disabled={isAnalyzing}
                      aria-label="URLを削除"
                    >
                      −
                    </button>
                  )}
                </div>
              ))}
            </div>
            {urls.length < 5 && (
              <button
                type="button"
                onClick={addUrl}
                className="mt-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors disabled:opacity-50"
                disabled={isAnalyzing}
              >
                + URLを追加
              </button>
            )}
          </div>

          {/* PDF入力セクション */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              PDF資料（オプション）
            </label>
            <input
              type="file"
              accept=".pdf,application/pdf"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
              disabled={isAnalyzing || isExtractingPdf}
            />
            {isExtractingPdf && (
              <p className="mt-2 text-sm text-blue-600">
                ⏳ PDFからテキストを抽出中...
              </p>
            )}
            {pdfFile && !isExtractingPdf && (
              <p className="mt-2 text-sm text-gray-600">
                ✓ <span className="font-medium">{pdfFile.name}</span> ({(pdfFile.size / 1024).toFixed(1)} KB)
                {pdfText && ` - ${pdfText.length}文字抽出`}
              </p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              ※ 最大10MBまで
            </p>
          </div>

          {/* 情報テキスト */}
          <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded-md">
            {type === 'own' ? (
              <p>
                💡 自社のWebサイトやPDF資料から<strong>企業名</strong>と<strong>サービス概要</strong>を自動抽出します。
                複数のソースを指定することで、より正確な情報を取得できます。
              </p>
            ) : (
              <p>
                💡 ターゲット企業のWebサイトや記事、PDF資料から<strong>企業名</strong>、<strong>氏名</strong>、<strong>背景情報</strong>を自動抽出します。
                プレスリリースやニュース記事のURLを含めると効果的です。
              </p>
            )}
          </div>
        </div>

        {/* フッター - アクションボタン */}
        <div className="p-4 border-t flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 bg-gray-100 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-200 transition-colors disabled:opacity-50"
            disabled={isAnalyzing}
            aria-label="キャンセル"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={handleAnalyze}
            className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isAnalyzing || isExtractingPdf || (!hasValidUrl && !pdfText)}
            aria-label="解析して入力"
          >
            {isAnalyzing ? '解析中...' : '解析して入力'}
          </button>
        </div>
      </div>
    </div>
  );
}
