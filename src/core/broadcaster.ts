import { createPublicClient, http } from 'viem';
import type { Hex } from 'viem';
import { getNetworkConfig } from './networkConfig';
import { RpcUrlSchema, SignedTransactionSchema, ErrorObjectSchema } from '../types/schema';
import { NetworkError, BroadcastError } from '../utils/errors';

/**
 * ネットワーク設定の取得とバリデーション
 * @param chainId 対象チェーンID
 * @param customRpcUrl カスタムRPCエンドポイント（オプション）
 * @returns 検証済みネットワーク設定
 * @throws NetworkError 不正なチェーンIDまたはRPC URL
 * @description ネットワーク設定の取得とRPC URLの検証を統合
 */
function getValidatedNetworkConfig(chainId: number, customRpcUrl?: string) {
  try {
    const networkConfig = getNetworkConfig(chainId);
    const rpcUrl = customRpcUrl || networkConfig.chain.rpcUrls.default.http[0];

    // ドメイン層でのRPC URLバリデーション
    const validatedRpcUrl = RpcUrlSchema.parse(rpcUrl);

    return {
      networkConfig,
      rpcUrl: validatedRpcUrl,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new NetworkError(`ネットワーク設定の取得に失敗しました: ${error.message}`);
    }
    throw new NetworkError('ネットワーク設定の取得に失敗しました');
  }
}

/**
 * 署名済みトランザクションの検証
 * @param signedTransaction 検証対象の署名済みトランザクション
 * @returns 検証済み署名済みトランザクション
 * @throws BroadcastError 無効なトランザクション形式
 * @description ドメイン層のスキーマを使用した検証
 */
function validateSignedTransaction(signedTransaction: unknown): Hex {
  try {
    return SignedTransactionSchema.parse(signedTransaction);
  } catch (error) {
    throw new BroadcastError(`無効な署名済みトランザクション形式です: ${(error as Error).message}`);
  }
}

/**
 * ブロードキャストエラーの判定
 * @param error エラーオブジェクト
 * @returns ブロードキャストエラーかどうか
 * @description ドメイン層のスキーマを使用したエラー判定
 */
function isBroadcastError(error: unknown): boolean {
  const result = ErrorObjectSchema.safeParse(error);
  if (!result.success) {
    return false;
  }

  const errorObj = result.data;
  const errorMessages = [errorObj.message || '', errorObj.details || ''];

  const broadcastErrorPatterns = [
    /transaction.*failed/i,
    /insufficient.*funds/i,
    /gas.*too.*low/i,
    /nonce.*too.*low/i,
    /replacement.*transaction.*underpriced/i,
  ];

  return broadcastErrorPatterns.some((pattern) =>
    errorMessages.some((message) => pattern.test(message))
  );
}

/**
 * エクスプローラーURLの生成
 * @param transactionHash トランザクションハッシュ
 * @param chainId チェーンID
 * @returns エクスプローラーURL（利用可能な場合）
 * @description ネットワーク設定からエクスプローラーURLを生成
 */
function generateExplorerUrl(transactionHash: Hex, chainId: number): string | undefined {
  try {
    const networkConfig = getNetworkConfig(chainId);
    return networkConfig.explorerBaseUrl
      ? `${networkConfig.explorerBaseUrl}/tx/${transactionHash}`
      : undefined;
  } catch {
    // エクスプローラーURL生成の失敗は致命的エラーではない
    return undefined;
  }
}

/**
 * トランザクションブロードキャスト結果の構築
 * @param transactionHash トランザクションハッシュ
 * @param chainId チェーンID
 * @returns ブロードキャスト結果
 * @description 成功結果の構築
 */
function buildBroadcastResult(
  transactionHash: Hex,
  chainId: number
): { transactionHash: Hex; explorerUrl?: string } {
  const explorerUrl = generateExplorerUrl(transactionHash, chainId);

  if (explorerUrl) {
    return { transactionHash, explorerUrl };
  }

  return { transactionHash };
}

/**
 * 署名済みトランザクションのブロードキャスト
 * @param signedTransaction 署名済みトランザクション（0xプレフィックス付き）
 * @param chainId 対象チェーンID
 * @param customRpcUrl カスタムRPCエンドポイント（オプション）
 * @returns ブロードキャスト結果
 * @throws NetworkError ネットワーク設定エラーの場合
 * @throws BroadcastError ブロードキャスト失敗の場合
 * @description ビジネスロジックの調整とワークフロー制御
 */
export async function broadcastTransaction(
  signedTransaction: unknown,
  chainId: number,
  customRpcUrl?: string
): Promise<{ transactionHash: Hex; explorerUrl?: string }> {
  // ドメイン層でのバリデーション
  const validatedTransaction = validateSignedTransaction(signedTransaction);
  const { networkConfig, rpcUrl } = getValidatedNetworkConfig(chainId, customRpcUrl);

  try {
    const publicClient = createPublicClient({
      chain: networkConfig.chain,
      transport: http(rpcUrl),
    });

    const transactionHash = await publicClient.sendRawTransaction({
      serializedTransaction: validatedTransaction,
    });

    return buildBroadcastResult(transactionHash, chainId);
  } catch (error: unknown) {
    if (isBroadcastError(error)) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new BroadcastError(`トランザクションのブロードキャストに失敗しました: ${errorMessage}`);
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new NetworkError(`ネットワーク通信エラー: ${errorMessage}`);
  }
}

export { getAllSupportedNetworks } from './networkConfig';
