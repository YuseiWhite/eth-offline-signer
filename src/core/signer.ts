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