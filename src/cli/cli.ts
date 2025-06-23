#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { program } from 'commander';
import { runCli } from '../core/app';

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
 * CLIエラーのハンドリング
 * @param error エラーオブジェクト
 * @description ユーザーフレンドリーなエラー表示（UI制御）
 */
function handleCliError(error: Error): void {
  if (error.name === 'InvalidInputError') {
    console.error(`❌ 入力エラー: ${error.message}`);
    return;
  }

  if (error.name === 'PrivateKeyError') {
    console.error(`🔐 秘密鍵エラー: ${error.message}`);
    return;
  }

  if (error.name === 'FileAccessError') {
    console.error(`📁 ファイルアクセスエラー: ${error.message}`);
    return;
  }

  if (error.name === 'NetworkError') {
    console.error(`🌐 ネットワークエラー: ${error.message}`);
    return;
  }

  if (error.name === 'BroadcastError') {
    console.error(`📡 ブロードキャストエラー: ${error.message}`);
    return;
  }

  // 予期しないエラー
  console.error(`💥 予期しないエラーが発生しました: ${error.message}`);
}

/**
 * パッケージバージョンの安全な取得
 * @returns パッケージバージョン（取得失敗時はデフォルト値）
 * @description 動的に取得
 */
function getPackageVersion(): string {
  const defaultVersion = '1.1.0';

  // 複数のパス候補を試行
  const packagePaths = [
    path.join(__dirname, '../../package.json'),
    path.join(process.cwd(), 'package.json'),
    path.resolve(__dirname, '../../../package.json'),
  ];

  for (const packageJsonPath of packagePaths) {
    try {
      const packageJsonContent = readFileSync(packageJsonPath, 'utf-8');
      const parsedPackageJson = JSON.parse(packageJsonContent);
      
      if (parsedPackageJson && typeof parsedPackageJson.version === 'string') {
        return parsedPackageJson.version;
      }
    } catch {
      // 次のパスを試行
      continue;
    }
  }

  console.warn(
    `⚠️  package.jsonが見つかりませんでした（${packagePaths.length}個のパスを確認済み）。デフォルトバージョン ${defaultVersion} を使用します。`
  );
  return defaultVersion;
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
     * @description core層のrunCliを呼び出し、エラーハンドリングのみを担当
     */
    async (options: {
      keyFile?: string;
      params?: string;
      broadcast?: boolean;
      rpcUrl?: string;
    }) => {
      try {
        // core層の唯一の窓口であるrunCliを呼び出す
        await runCli(options);
      } catch (error: unknown) {
        // core層からスローされたエラーをここで受け取り、表示に徹する
        handleCliError(toError(error));
        process.exit(1); // エラー発生時は非ゼロの終了コードでプロセスを終了する
      }
    }
  );

// エラーイベントのハンドリング
program.exitOverride((err) => {
  if (err.code === 'commander.helpDisplayed') {
    process.exit(0);
  }
  if (err.code === 'commander.version') {
    process.exit(0);
  }
  handleCliError(new Error(`CLIコマンドエラー: ${err.message}`));
  process.exit(1);
});

program.parse();
