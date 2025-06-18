import type {
  Hex,
  PrivateKeyAccount,
  TransactionSerializableEIP1559,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import type { EIP1559TxParams } from '../types/schema'; // Zodで検証済みのパラメータ
import { SigningError } from '../utils/errors';

/**
 * 秘密鍵からviemアカウントを安全に作成する
 * @param privateKey 0xプレフィックス付きの秘密鍵（keyManagerで検証済み）
 * @returns viemアカウントインスタンス
 * @throws SigningError アカウント作成に失敗した場合
 * @description privateKeyToAccountのラッパー関数、エラーハンドリングと日本語メッセージ提供
 */
function createAccountFromPrivateKey(privateKey: `0x${string}`): PrivateKeyAccount {
  try {
    return privateKeyToAccount(privateKey);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new SigningError(`秘密鍵からアカウントの作成に失敗しました: ${errorMessage}`);
  }
}

/**
 * 文字列の数値をBigIntに安全に変換する
 * @param value 変換対象の数値文字列（Zodで検証済み）
 * @param fieldName エラーメッセージ用のフィールド名
 * @returns BigInt値
 * @throws SigningError BigInt変換に失敗した場合
 * @description 数値文字列からBigIntへの変換とエラーハンドリング
 */
function safeStringToBigInt(value: string, fieldName: string): bigint {
  try {
    return BigInt(value);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new SigningError(`${fieldName}のBigInt変換に失敗しました: ${errorMessage}`);
  }
}

/**
 * EIP-1559トランザクションパラメータからviem形式のリクエストオブジェクトを作成する
 * @param txParams EIP-1559トランザクションパラメータ（Zodで検証済み）
 * @returns viemトランザクションオブジェクト
 * @throws SigningError BigInt変換またはアクセスリスト処理に失敗した場合
 * @description Zodで検証済みのパラメータを安全にviem形式に変換
 */
function createTransactionRequest(txParams: EIP1559TxParams): TransactionSerializableEIP1559 {
  const transactionRequest: TransactionSerializableEIP1559 = {
    to: txParams.to as Hex, // Zodスキーマで `0x${string}` 形式を保証
    value: safeStringToBigInt(txParams.value, 'value'),
    chainId: txParams.chainId,
    nonce: txParams.nonce, // 必須フィールドとして検証済み
    gas: safeStringToBigInt(txParams.gasLimit, 'gasLimit'),
    maxFeePerGas: safeStringToBigInt(txParams.maxFeePerGas, 'maxFeePerGas'),
    maxPriorityFeePerGas: safeStringToBigInt(txParams.maxPriorityFeePerGas, 'maxPriorityFeePerGas'),
    type: 'eip1559',
  };

  // アクセスリストが提供されていれば追加（EIP-2930のオプション機能）
  if (txParams.accessList && txParams.accessList.length > 0) {
    transactionRequest.accessList = txParams.accessList.map((item) => ({
      address: item.address as Hex,
      storageKeys: item.storageKeys as Hex[],
    }));
  }

  return transactionRequest;
}

/**
 * viemアカウントでトランザクションに署名する
 * @param account viemアカウントインスタンス
 * @param transactionRequest 署名対象のトランザクション
 * @returns 署名済みトランザクション（0xプレフィックス付き16進数文字列）
 * @throws SigningError トランザクション署名に失敗した場合
 * @description viemによるトランザクション署名とエラーハンドリング
 */
async function signTransactionWithAccount(
  account: PrivateKeyAccount,
  transactionRequest: TransactionSerializableEIP1559
): Promise<Hex> {
  try {
    return await account.signTransaction(transactionRequest);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new SigningError(`トランザクションの署名に失敗しました: ${errorMessage}`);
  }
}
