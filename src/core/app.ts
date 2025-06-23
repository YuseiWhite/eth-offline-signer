import { readFileSync } from 'node:fs';
import path from 'node:path';
import { privateKeyToAccount } from 'viem/accounts';
import { ZodError } from 'zod';

// core内部の依存
import { loadPrivateKey } from './keyManager';
import { processTransaction, DEFAULT_MAX_RETRIES } from './transactionProcessor';
import { getDisplayNetworkInfo } from './networkConfig';

// typesへの依存
import { validateEIP1559TxParams, validateCliOptions, type CliOptions } from '../types/schema';

// utilsへの依存 (core -> utils は許可された依存関係)
import { InvalidInputError } from '../utils/errors';

// cli.tsから移譲されたロジック
function loadTransactionParams(filePath: string) {
  const resolvedPath = path.resolve(filePath);
  try {
    const paramsJson: unknown = JSON.parse(readFileSync(resolvedPath, 'utf-8'));
    return validateEIP1559TxParams(paramsJson);
  } catch (error) {
    if (error instanceof ZodError) {
      const errorMessages = error.errors
        .map((e) => {
          const path = e.path.join('.');
          return `${path ? `${path}: ` : ''}${e.message}`;
        })
        .join('; ');
      throw new InvalidInputError(`無効なトランザクションパラメータです: ${errorMessages}`);
    }
    throw new InvalidInputError(
      `トランザクションパラメータファイル (${resolvedPath}) の読み込みまたはJSONパースに失敗しました。詳細: ${(error as Error).message}`
    );
  }
}

// cli.tsから移譲された表示ロジックもここに含める
function displayNetworkInfo(chainId: number): void {
  const networkInfo = getDisplayNetworkInfo(chainId);
  console.info(`🌐 検出されたネットワーク: ${networkInfo.name} (Chain ID: ${chainId})`);
  console.info(`🔍 対応エクスプローラー: ${networkInfo.explorer}`);

  if (networkInfo.type === 'custom') {
    console.info('⚠️  カスタムネットワークです。ブロードキャスト先が正しいことを確認してください。');
  }
}

/**
 * アプリケーションのメインロジック (CLIからの唯一のエントリーポイント)
 * @param options CLIから渡されたオプション
 */
export async function runCli(options: CliOptions) {
  let privateKeyHandle: Awaited<ReturnType<typeof loadPrivateKey>> | undefined;
  try {
    validateCliOptions(options);

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

  } finally {
    // finallyブロックはこちらに移動。coreロジックのリソース解放はcoreが責任を持つ。
    if (privateKeyHandle?.cleanup) {
      privateKeyHandle.cleanup();
    }
  }
}