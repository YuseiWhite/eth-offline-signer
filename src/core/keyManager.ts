import fs from 'node:fs/promises';
import path from 'node:path';
import { FileAccessError, PrivateKeyError } from '../utils/errors';

/**
 * 秘密鍵読み込み結果の型定義
 * @description viemが期待する0xプレフィックス付き形式とクリーンアップ関数を提供
 */
interface LoadPrivateKeyResult {
  privateKey: `0x${string}`; // viemが期待する0xプレフィックス付きの形式
  cleanup: () => void; // 秘密鍵の参照を破棄するための関数
}
