import { POST as suggestStructurePost } from '../suggest-structure/route';

/**
 * /api/consult は /api/suggest-structure のエイリアスです。
 * 従来の名称での呼び出しに対応するために作成されました。
 */
export const POST = suggestStructurePost;
export const maxDuration = 60;
