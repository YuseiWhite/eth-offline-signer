#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Command } from 'commander';
import { privateKeyToAccount } from 'viem/accounts';
import { loadPrivateKey } from '../core/keyManager';
import { processTransaction, DEFAULT_MAX_RETRIES } from '../core/transactionProcessor';
import { getDisplayNetworkInfo } from '../core/networkConfig';
import { validateEIP1559TxParams } from '../types/schema';
import { InvalidInputError, handleCliError } from '../utils/errors';

const program = new Command();

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

/**
 * パッケージバージョンの安全な取得
 * @returns パッケージバージョン（取得失敗時はデフォルト値）
 * @description エラー時は警告を出力してデフォルト値を使用
 */
function getPackageVersion(): string {
  const defaultVersion = '1.1.0';

  try {
    const packageJsonPath = path.join(__dirname, '../package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

    if (typeof packageJson.version === 'string' && packageJson.version.trim()) {
      return packageJson.version;
    }

    console.warn(
      `⚠️  package.jsonにバージョン情報が見つかりません。デフォルトバージョン ${defaultVersion} を使用します。`
    );
    return defaultVersion;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn(
      `⚠️  package.json読み込みエラー: ${errorMessage}。デフォルトバージョン ${defaultVersion} を使用します。`
    );
    return defaultVersion;
  }
}

const packageVersion = getPackageVersion();

program.version(packageVersion, '-v, --version', '現在のバージョンを出力します');

program
  .command('sign')
  .description('Ethereumトランザクションをオフラインで署名し、オプションでブロードキャストします。')
  .option('-k, --key-file <path>', '秘密鍵が含まれるファイルへのパス。')
  .option('-p, --params <path>', 'トランザクションパラメータが含まれるJSONファイルへのパス。')
  .option('--broadcast', 'トランザクションをネットワークにブロードキャストします。')
  .option('--rpc-url <url>', 'カスタムRPCエンドポイントのURL。')
  .allowUnknownOption(false)
  .action(
    /**
     * signコマンドのメイン処理
     * @param options CLIオプション
     * @description 入力検証→秘密鍵読み込み→パラメータ検証→ネットワーク確認→トランザクション処理の流れ
     */
    async (options: {
      keyFile?: string;
      params?: string;
      broadcast?: boolean;
      rpcUrl?: string;
    }) => {
      let privateKeyHandle: Awaited<ReturnType<typeof loadPrivateKey>> | undefined;
      try {
        validateCliOptions(options);
        // この時点でoptionsはValidatedCliOptionsとして型が絞り込まれている

        privateKeyHandle = await loadPrivateKey(options.keyFile);
        const account = privateKeyToAccount(privateKeyHandle.privateKey);
        console.info(`🔑 使用するアドレス: ${account.address}`);

        const validatedParams = loadTransactionParams(options.params);
        displayNetworkInfo(validatedParams.chainId);

        const processorOptions: Parameters<typeof processTransaction>[0] = {
          privateKey: privateKeyHandle.privateKey,
          txParams: validatedParams,
          broadcast: !!options.broadcast,
          maxRetries: DEFAULT_MAX_RETRIES,
          ...(options.rpcUrl && { rpcUrl: options.rpcUrl }),
        };

        await processTransaction(processorOptions);
      } catch (error: unknown) {
        handleCliError(toError(error));
      } finally {
        if (privateKeyHandle?.cleanup) {
          privateKeyHandle.cleanup();
        }
      }
    }
  );
