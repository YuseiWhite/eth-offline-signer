#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { getDisplayNetworkInfo } from '../core/networkConfig';
import { validateEIP1559TxParams } from '../types/schema';
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

/**
 * トランザクションパラメータファイルの読み込み
 * @param filePath パラメータファイルのパス
 * @returns バリデーション済みのトランザクションパラメータ
 * @throws InvalidInputError ファイル読み込みまたはパースに失敗した場合
 */
function loadTransactionParams(filePath: string) {
  const resolvedPath = path.resolve(filePath);
  try {
    const paramsJson: unknown = JSON.parse(readFileSync(resolvedPath, 'utf-8'));
    return validateEIP1559TxParams(paramsJson);
  } catch (error) {
    throw new InvalidInputError(
      `トランザクションパラメータファイル (${resolvedPath}) の読み込みまたはJSONパースに失敗しました。詳細: ${(error as Error).message}`
    );
  }
}

/**
 * ネットワーク情報の表示
 * @param chainId チェーンID
 * @description core/networkConfigから取得した情報を表示するのみ
 */
function displayNetworkInfo(chainId: number): void {
  const networkInfo = getDisplayNetworkInfo(chainId);
  console.info(`🌐 検出されたネットワーク: ${networkInfo.name} (Chain ID: ${chainId})`);
  console.info(`🔍 対応エクスプローラー: ${networkInfo.explorer}`);

  if (networkInfo.type === 'custom') {
    console.info('⚠️  カスタムネットワークです。ブロードキャスト先が正しいことを確認してください。');
  }
}
