#!/usr/bin/env node

/**
 * 検証済みCLIオプションの型定義
 * @description バリデーション後の必須オプションが保証された型
 */
interface ValidatedCliOptions {
  keyFile: string;
  params: string;
  broadcast: boolean;
  rpcUrl?: string;
}

/**
 * unknownエラーを安全にErrorオブジェクトに変換
 * @param error 変換対象のエラー
 * @returns Errorオブジェクト
 * @description 型アサーションを使わずに安全な型変換を実行
 */
function toError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }
  return new Error(String(error));
}
