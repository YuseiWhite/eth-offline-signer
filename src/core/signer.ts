import type { PrivateKeyAccount } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
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
