#!/usr/bin/env node

import { InvalidInputError } from '../utils/errors';

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

/**
 * CLIオプションのバリデーション（型ガード）
 * @param options CLIオプション
 * @throws InvalidInputError 必須オプションが不足している場合
 */
function validateCliOptions(options: {
  keyFile?: string;
  params?: string;
  broadcast?: boolean;
  rpcUrl?: string;
}): asserts options is ValidatedCliOptions {
  if (!options.keyFile) {
    throw new InvalidInputError(
      '--key-fileオプションで秘密鍵ファイルへのパスを指定する必要があります。'
    );
  }
  if (!options.params) {
    throw new InvalidInputError(
      '--paramsオプションでトランザクションパラメータファイルへのパスを指定する必要があります。'
    );
  }
  if (options.broadcast && !options.rpcUrl) {
    throw new InvalidInputError(
      '--broadcastオプションを使用する場合は、--rpc-urlオプションでRPCエンドポイントを指定する必要があります。'
    );
  }
}
