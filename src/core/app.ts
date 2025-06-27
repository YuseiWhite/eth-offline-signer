import { readFileSync } from 'node:fs';
import path from 'node:path';
import { privateKeyToAccount } from 'viem/accounts';
import { ZodError } from 'zod';

// core内部の依存
import { loadPrivateKey } from './keyManager';
import { processTransaction, DEFAULT_MAX_RETRIES } from './transactionProcessor';
import { getDisplayNetworkInfo } from './networkConfig';

// typesへの依存
import {
  validateEIP1559TxParams,
  validateCliOptions,
  validateTransactionProcessorOptions,
} from '../types/schema';

// utilsへの依存 (core -> utils は許可された依存関係)
import { InvalidInputError } from '../utils/errors';
import { createLogger } from '../utils/logger';

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
function displayNetworkInfo(chainId: number, logger: ReturnType<typeof createLogger>): void {
  const networkInfo = getDisplayNetworkInfo(chainId);
  logger.info(`🌐 検出されたネットワーク: ${networkInfo.name} (Chain ID: ${chainId})`);
  logger.info(`🔍 対応エクスプローラー: ${networkInfo.explorer}`);

  if (networkInfo.type === 'custom') {
    logger.info('⚠️  カスタムネットワークです。ブロードキャスト先が正しいことを確認してください。');
  }
}

/**
 * アプリケーションのメインロジック (CLIからの唯一のエントリーポイント)
 * @param rawOptions CLIから渡されたオプション
 */
export async function runCli(rawOptions: unknown) {
  let privateKeyHandle: Awaited<ReturnType<typeof loadPrivateKey>> | undefined;
  try {
    const options = validateCliOptions(rawOptions);

    // ファクトリパターンでquietモードの判定をロガー生成時に集約
    const logger = createLogger({ quiet: options.quiet });

    privateKeyHandle = await loadPrivateKey(options.keyFile);
    const account = privateKeyToAccount(privateKeyHandle.privateKey);
    logger.info(`🔑 使用するアドレス: ${account.address}`);

    const validatedParams = loadTransactionParams(options.params);
    displayNetworkInfo(validatedParams.chainId, logger);

    const transactionOptionsRaw = {
      privateKey: privateKeyHandle.privateKey,
      txParams: validatedParams,
      broadcast: options.broadcast,
      maxRetries: DEFAULT_MAX_RETRIES,
      logger,
      ...(options.rpcUrl && { rpcUrl: options.rpcUrl }),
    };
    const transactionOptions = validateTransactionProcessorOptions(transactionOptionsRaw);
    const result = await processTransaction(transactionOptions);

    // データ出力：quietモードではstdout、通常モードではstderrに情報を出力
    if (options.quiet) {
      if (!options.broadcast) {
        logger.data(result.signedTransaction);
      } else if (result.broadcast?.status === 'SUCCESS' && result.broadcast.transactionHash) {
        logger.data(result.broadcast.transactionHash);
      }
    } else if (!options.broadcast) {
        // 通常モードでは、stderrに署名済みトランザクションを出力
        logger.info(`📝 署名済みトランザクション: ${result.signedTransaction}`);
    }
  } finally {
    // finallyブロックはこちらに移動。coreロジックのリソース解放はcoreが責任を持つ。
    if (privateKeyHandle?.cleanup) {
      privateKeyHandle.cleanup();
    }
  }
}
