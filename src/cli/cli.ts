#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { program } from 'commander';
import { ZodError } from 'zod';
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
 * CLIオプションバリデーションエラーのハンドリング
 * @param zodError ZodErrorオブジェクト
 * @description ユーザーフレンドリーなエラーメッセージを表示
 */
function handleCliValidationError(zodError: ZodError): void {
  const errors = zodError.errors;

  const missingKeyFile = errors.some(e => e.path.includes('keyFile'));
  const missingParams = errors.some(e => e.path.includes('params'));

  // keyFileとparamsの両方が不足している場合
  if (missingKeyFile && missingParams) {
    console.error('必須オプションが不足しています:');
    console.error('   --key-file: 秘密鍵ファイル（.key拡張子）のパスを指定してください');
    console.error('   --params: トランザクションパラメータJSONファイルのパスを指定してください');
    console.error('');
    console.error('使用例: node dist/cli.cjs sign --key-file private.key --params transaction.json');
    return;
  }

  // keyFileのみ不足
  if (missingKeyFile) {
    console.error('--key-fileオプションが必要です');
    console.error('   秘密鍵ファイル（.key拡張子）のパスを指定してください');
    return;
  }

  // paramsのみ不足
  if (missingParams) {
    console.error('--paramsオプションが必要です');
    console.error('   トランザクションパラメータJSONファイルのパスを指定してください');
    return;
  }

  // --broadcastオプション使用時のrpcUrlエラー
  const rpcUrlError = errors.find(e => e.path.includes('rpcUrl'));
  if (rpcUrlError) {
    console.error('--broadcastオプションを使用する場合は、--rpc-urlオプションでRPCエンドポイントを指定する必要があります');
    console.error('');
    console.error('使用例: node dist/cli.cjs sign --key-file private.key --params transaction.json --broadcast --rpc-url https://eth-<network>.g.alchemy.com/v2/<YOUR_API_KEY>');
    return;
  }

  // その他のバリデーションエラー
  for (const error of errors) {
    const field = error.path.join('.');
    console.error(`${field}: ${error.message}`);
  }
}

/**
 * CLIエラーのハンドリング
 * @param error エラーオブジェクト
 * @description ユーザーフレンドリーなエラー表示（UI制御）
 */
function handleCliError(error: Error): void {
  if (error instanceof ZodError) {
    handleCliValidationError(error);
    return;
  }

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
 * @param packagePathsToTry テスト用などに指定可能な package.json のパス配列
 * @returns パッケージバージョン（取得失敗時はデフォルト値）
 * @description 動的に取得
 */
function getPackageVersion(packagePathsToTry?: string[]): string {
  const defaultVersion = '1.1.0';

  // 複数のパス候補を試行
  const packagePaths = packagePathsToTry ?? [
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
  .option('-q, --quiet', '署名済みトランザクションデータまたはトランザクションハッシュのみ出力します。')
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
      quiet?: boolean;
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

// only execute parsing when run as a script
if (require.main === module) {
  program.parse();
}

// export for testing
export { toError, handleCliError, getPackageVersion, program };
