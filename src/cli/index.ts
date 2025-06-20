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
