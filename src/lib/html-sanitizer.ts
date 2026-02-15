/**
 * HTML安全テキスト抽出ユーティリティ
 * プロンプトインジェクション対策として、隠しテキストや不要な要素を除去
 */

import type { CheerioAPI } from 'cheerio';

/**
 * HTMLから隠しテキストと不要な要素を除去する
 * プロンプトインジェクション防止のため、不可視要素を徹底的に排除
 *
 * @param $ cheerio インスタンス
 */
export function sanitizeHtml($: CheerioAPI): void {
  // 1. 基本的な不要要素を削除
  $('script').remove();
  $('style').remove();
  $('noscript').remove();
  $('iframe').remove();
  $('nav').remove();
  $('footer').remove();
  $('header').remove();

  // 2. HTMLコメントを削除
  $('*').contents().each(function () {
    if (this.type === 'comment') {
      $(this).remove();
    }
  });

  // 3. hidden属性を持つ要素を削除
  $('[hidden]').remove();
  $('[aria-hidden="true"]').remove();

  // 4. display:none / visibility:hidden / opacity:0 等の不可視スタイルを持つ要素を削除
  $('[style]').each(function () {
    const style = $(this).attr('style') || '';
    const normalizedStyle = style.toLowerCase().replace(/\s+/g, '');

    if (
      normalizedStyle.includes('display:none') ||
      normalizedStyle.includes('visibility:hidden') ||
      normalizedStyle.includes('opacity:0') ||
      normalizedStyle.includes('font-size:0') ||
      normalizedStyle.includes('height:0') ||
      normalizedStyle.includes('width:0') ||
      normalizedStyle.includes('overflow:hidden') && (
        normalizedStyle.includes('height:0') ||
        normalizedStyle.includes('max-height:0')
      ) ||
      normalizedStyle.includes('position:absolute') && (
        normalizedStyle.includes('left:-') ||
        normalizedStyle.includes('top:-')
      ) ||
      normalizedStyle.includes('clip:rect(0')
    ) {
      $(this).remove();
    }
  });

  // 5. よく使われる隠し要素のクラス名パターン
  const hiddenClassPatterns = [
    '.hidden', '.d-none', '.invisible', '.sr-only', '.screen-reader-only',
    '.visually-hidden', '.offscreen', '.clip',
  ];
  $(hiddenClassPatterns.join(', ')).remove();

  // 6. type="hidden" のinput要素を削除
  $('input[type="hidden"]').remove();
}

/**
 * HTMLからメインコンテンツのテキストを安全に抽出する
 *
 * @param $ cheerio インスタンス
 * @param maxLength 最大文字数
 * @returns 安全に抽出されたテキスト
 */
export function extractSafeText($: CheerioAPI, maxLength: number = 5000): string {
  // 隠しテキスト除去を適用
  sanitizeHtml($);

  // メインコンテンツを抽出
  let mainText = '';
  const mainSelectors = ['main', 'article', '[role="main"]', '.content', '#content', 'body'];

  for (const selector of mainSelectors) {
    const element = $(selector);
    if (element.length > 0) {
      mainText = element.text();
      break;
    }
  }

  // テキストをクリーンアップ
  return mainText
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, maxLength);
}
