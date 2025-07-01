# 詳細設計書: eth-offline-signer (v1.1.0)

## 0. はじめに (Introduction)
目的 (Purpose): 本書は、「要件定義書: eth-offline-signer (v1.1.0)」に基づき、eth-offline-signer CLIアプリケーションの実装に必要な詳細設計を定義します。

スコープ (Scope): 本書のスコープは、オフラインでのEIP-1559トランザクション署名機能、およびオプションとしてのオンラインでのブロードキャスト、Nonce競合時の自動リトライ、トランザクションマイニング完了の追跡機能の実装に限定されます。

選択されたトランザクション種別 (Selected Transaction Type): 要件定義書 2.4 に基づき、本設計では EIP-1559 トランザクション種別を実装対象として選択します。この選択は、現在のEthereumネットワークにおける標準的なトランザクション形式であり、ガス料金管理の柔軟性が高いためです。

## 0.1. アーキテクチャ設計方針

### 0.1.1. アーキテクチャ選定根拠

**プロダクト特性分析**:
- 単一ドメイン（Ethereumトランザクション処理）
- 比較的シンプルなビジネスロジック（署名、ブロードキャスト、リトライ）
- データ永続化なし（ファイル読み込み、メモリ内状態管理のみ）
- オンライン・オフライン両対応のデュアルモード
- CLI単一インターフェース

**アーキテクチャ適合性評価**:

| アーキテクチャパターン | 適合度 | 評価理由 |
|-------------------|-------|----------|
| **層状アーキテクチャ** | ✅ **最適** | 関心事の分離が明確で理解しやすく、過剰設計を回避しつつ、各コンポーネントの責務を明確化できる。 |
| クリーンアーキテクチャ | ❌ 過剰 | 依存性注入は採用するが、フレームワーク全体を導入するのは現在のスコープに対して過剰。 |
| ヘキサゴナルアーキテクチャ | ❌ 過剰 | 外部システム連携はRPCのみであり、ポート/アダプターの抽象化は不要。 |

**選定結果**: **4層アーキテクチャ（4-Layer Architecture）**

### 0.1.2. 実装アーキテクチャ

**層構造図**:
```
┌───────────────────────────────────────────┐
│              CLI Layer (Presentation)     │
│       src/cli/cli.ts (commander.js)       │
└─────────────────────┬─────────────────────┘
                      │ 依存
┌─────────────────────▼─────────────────────┐
│       Application Layer (Business Logic)  │
│      src/core/app.ts (Orchestrator)       │
│  src/core/transactionProcessor.ts (Flow)  │
└──────────┬───────────────────────┬────────┘
           │ 依存                  │ 依存
┌──────────▼────────────┐   ┌───────▼───────────┐
│     Domain Layer      │   │ Infrastructure    │
│(Business Rules/Models)│   │     Layer         │
│  src/types/schema.ts  │   │ (External Access) │
│ (Zod, viem types)     │   │  src/utils/*      │
└───────────────────────┘   │  src/core/*       │
                            └───────────────────┘
```
*`src/core`の一部(keyManager, broadcaster, nonceRetry)は、外部I/Oや状態管理の側面からインフラ層の責務も担うハイブリッドなコンポーネントとして設計。*

**層定義**:

1. **CLI Layer** (`src/cli/`): プレゼンテーション層
   - 責務: ユーザーからの入力解析、コマンド実行のトリガー、最終結果の表示。
   - 技術: commander.js
   - 依存: Application Layer のみ (`app.ts`を呼び出す)

2. **Application Layer** (`src/core/app.ts`, `src/core/transactionProcessor.ts`): アプリケーション層
   - 責務: ビジネスロジック全体の調整、ワークフロー制御。`app.ts`がCLIとコアロジックを繋ぎ、`transactionProcessor.ts`が署名からブロードキャストまでの一連の複雑なフローを管理する。
   - 技術: TypeScript
   - 依存: Domain Layer, Infrastructure Layer

3. **Domain Layer** (`src/types/`): ドメイン層
   - 責務: ビジネスルールとデータモデルの定義。トランザクションパラメータの構造やバリデーションルールを規定する。
   - 技術: Zod, TypeScript (viemの型定義も利用)
   - 依存: なし（Pure）

4. **Infrastructure Layer** (`src/utils/`, `src/core/`の一部): インフラストラクチャ層
   - 責務: ファイルシステムアクセス、ネットワーク通信、エラー定義、ロギングなどの横断的関心事を担当。
   - コンポーネント:
     - `keyManager.ts`: ファイルシステムからの鍵読み込み
     - `broadcaster.ts`, `nonceRetry.ts`: RPCノードとのネットワーク通信
     - `logger.ts`: コンソールへのログ出力
     - `errors.ts`: カスタムエラー定義
   - 技術: Node.js API, viem (RPCクライアントとして)

### 0.1.3. 設計原則と具体例

**1. 単一責任原則 (SRP)**:
- `signer.ts`: 暗号学的署名処理のみに責任を持つ。
- `keyManager.ts`: ファイルからの秘密鍵の読み込みとパーミッション検証のみ。
- `broadcaster.ts`: RPCノードへのトランザクション送信のみ。
- `nonceRetry.ts`: Nonce競合時のリトライロジックのみ。
- `transactionProcessor.ts`: 上記コンポーネントを組み合わせて、トランザクション処理の複雑なワークフローを調整する。

**2. 依存性注入 (DI)**:
テスト容易性を高めるため、ロガーのように外部依存性を持つモジュールは注入可能な設計とする。
```typescript
// transactionProcessor.ts
export async function processTransaction(
  options: TransactionProcessorOptions
): Promise<TransactionProcessorResult> {
  const { logger: userLogger = loggerInstance } = options; // DI
  // ...
  userLogger.info('トランザクションの署名を開始...');
}

// テストコード
it('should use custom logger', async () => {
  const mockLogger = createMockLogger();
  await processTransaction({ ..., logger: mockLogger });
  expect(mockLogger.info).toHaveBeenCalled();
});
```

**3. 関数ベースアプローチ**:
状態を持つクラスは最小限に留め、純粋関数に近いステートレスな関数を中心に実装する。これにより、テストが容易になり、コードの見通しが良くなる。

## 1. ディレクトリ構造 (Directory Structure)
```.sh
eth-offline-signer/
├── .github/
│   └── workflows/
│       └── ci.yml
├── .husky/
│   └── pre-commit
├── dist/
├── coverage/
├── src/
│   ├── cli/
│   │   └── cli.ts         # CLIエントリーポイント、commander.jsセットアップ
│   ├── core/
│   │   ├── app.ts         # CLIとコアロジックの連携
│   │   ├── broadcaster.ts # トランザクションのブロードキャスト
│   │   ├── keyManager.ts  # 秘密鍵の読み込みと検証
│   │   ├── networkConfig.ts# ネットワーク設定
│   │   ├── nonceRetry.ts  # Nonce競合リトライロジック
│   │   ├── signer.ts      # トランザクション署名ロジック (viem)
│   │   └── transactionProcessor.ts # 署名からブロードキャストまでのフロー制御
│   ├── types/
│   │   └── schema.ts      # 入力検証用 Zod スキーマ
│   └── utils/
│       ├── errors.ts      # カスタムエラークラス
│       └── logger.ts      # コンソールロギングユーティリティ
├── test/
│   ├── fixtures/
│   │   └── test-params.json
│   ├── integration/
│   │   ├── anvil.test.ts  # Anvil連携テスト
│   │   └── cli.test.ts    # CLI E2Eテスト
│   ├── unit/
│   │   ├── cli/
│   │   ├── core/
│   │   ├── types/
│   │   └── utils/
│   └── globalSetup.ts
├── biome.json             # Biome (Linter/Formatter) 設定
├── package.json
├── tsconfig.json
└── tsup.config.ts
```

## 2. CLIコマンド実装 (src/cli/cli.ts & src/core/app.ts)
`src/cli/cli.ts`はユーザー入力を解析し、`src/core/app.ts`に処理を委譲する薄いラッパーとして機能する。主要なロジックは`app.ts`がオーケストレーションする。

### 2.1. src/cli/cli.ts
- `commander.js`を用いてコマンドとオプションを定義。
- パラメータを整形し、`app.ts`の`run`関数を呼び出す。
- `try...catch`ブロックでアプリケーション全体のエラーを捕捉し、`handleCliError`で処理する。

### 2.2. src/core/app.ts
- CLIから渡されたオプションに基づき、`keyManager`や`transactionProcessor`などのコアモジュールを呼び出す。
- `loadPrivateKey`で秘密鍵を安全に読み込み、`cleanup`関数を`finally`ブロックで確実に呼び出す。
- `processTransaction`を呼び出して主要なワークフローを開始する。
- 結果を整形し、ユーザーフレンドリーな形式でコンソールに出力する。

## 3. 入力バリデーション (zod) (src/types/schema.ts)
`--params`で渡されるJSONオブジェクトを検証するためのZodスキーマ。EIP-1559に必要なフィールドを厳格に定義する。

```typescript
// src/types/schema.ts
import { z } from 'zod';

const HexSchema = z.string().regex(/^0x[a-fA-F0-9]+$/);
const EthereumAddressSchema = HexSchema.length(42);
const NumericStringSchema = z.string().regex(/^\d+$/);

export const EIP1559TxParamsSchema = z.object({
  to: EthereumAddressSchema,
  value: NumericStringSchema,
  chainId: z.number().int().positive(),
  nonce: z.number().int().nonnegative(),
  gasLimit: NumericStringSchema,
  maxFeePerGas: NumericStringSchema,
  maxPriorityFeePerGas: NumericStringSchema,
  accessList: z.array(z.object({
    address: EthereumAddressSchema,
    storageKeys: z.array(HexSchema.length(66)),
  })).optional(),
}).strict(); // 未知のキーを許可しない

export type EIP1559TxParams = z.infer<typeof EIP1559TxParamsSchema>;
```

## 4. 秘密鍵管理 (src/core/keyManager.ts)
ファイルから秘密鍵を安全に読み込み、検証し、使用後にメモリから破棄するメカニズムを提供する。

- **ファイルパーミッションチェック**: POSIX環境では`fs.statSync`でパーミッションが`400`であることを確認。それ以外の場合は警告を表示。Windowsではチェックをスキップし、警告のみ表示。
- **秘密鍵の正規化**: `0x`プレフィックスを付与し、66文字の16進数文字列(`0x` + 64文字)に整形する。
- **クリーンアップ関数**: 読み込んだ秘密鍵の参照をメモリ上からクリアするための`cleanup`関数を返す。呼び出し元(`app.ts`)は`finally`ブロックでこの関数を呼び出す責務を負う。

## 5. オフライン署名コアロジック (viem) (src/core/signer.ts)
`viem`ライブラリを使用し、完全にオフラインでEIP-1559トランザクションの署名を実行する。

```typescript
// src/core/signer.ts の主要部分
import { privateKeyToAccount } from 'viem/accounts';
import { SigningError } from '../utils/errors';

export async function signEIP1559TransactionOffline(
  privateKey: `0x${string}`,
  txParams: EIP1559TxParams
): Promise<Hex> {
  try {
    const account = privateKeyToAccount(privateKey);
    const signedTx = await account.signTransaction({
      to: txParams.to,
      value: BigInt(txParams.value),
    chainId: txParams.chainId,
      nonce: txParams.nonce,
      gas: BigInt(txParams.gasLimit),
    maxFeePerGas: BigInt(txParams.maxFeePerGas),
    maxPriorityFeePerGas: BigInt(txParams.maxPriorityFeePerGas),
      accessList: txParams.accessList,
    type: 'eip1559',
    });
    return signedTx;
  } catch (error: any) {
    throw new SigningError(`トランザクションの署名に失敗しました: ${error.message}`);
  }
}
```

## 6. トランザクション処理フロー (src/core/transactionProcessor.ts)
署名、ブロードキャスト、Nonceリトライ、レシート待機という一連の複雑なプロセスをオーケストレーションする中心的なモジュール。

1.  **署名**: `signer.ts`を呼び出してオフライン署名を実行。
2.  **ブロードキャスト分岐**: `--broadcast`フラグが`true`の場合のみ次のステップへ。
3.  **ブロードキャスト実行**: `broadcaster.ts`を呼び出して署名済みトランザクションを送信。
4.  **Nonceリトライ**: `broadcaster.ts`内で`nonceRetry.ts`の`executeWithNonceRetry`を利用。`eth_sendRawTransaction`が"nonce too low"等のエラーを返した場合、インクリメントしたNonceでリトライ処理を行う。
5.  **レシート待機**: ブロードキャスト成功後、`viem`の`waitForTransactionReceipt`を呼び出し、トランザクションがブロックに取り込まれるのを待つ。
6.  **結果構築**: 全てのステップの結果を`TransactionProcessorResult`オブジェクトにまとめて返す。

## 7. ブロードキャストとNonce管理 (src/core/broadcaster.ts, src/core/nonceRetry.ts)

### 7.1. broadcaster.ts
- `viem`の`createPublicClient`と`http`トランスポートを使用してRPCクライアントを生成。
- `sendRawTransaction`を呼び出してトランザクションを送信する。
- この送信処理を`nonceRetry.ts`にラップさせることで、Nonceエラーからの自動回復を実現。

### 7.2. nonceRetry.ts
- 高階関数`executeWithNonceRetry`を定義。
- この関数は、実行する非同期関数（この場合はトランザクション送信）とリトライ回数を引数に取る。
- Nonce関連のエラーを検知した場合、Nonceをインクリメントして再度実行する。指数関数的バックオフは実装せず、即時リトライを行う。

## 8. テスト戦略 (Vitest)
- **単体テスト (`test/unit`)**: 各モジュールの責務を独立して検証。`vi.mock`を多用して外部依存（`fs`、`viem`の一部）をモック化する。特に`signer`、`keyManager`、`schema`、`nonceRetry`のロジックを重点的にテストする。
- **結合テスト (`test/integration`)**:
  - `cli.test.ts`: `execa`を使用し、CLIのE2Eテストを実施。成功ケース、パラメータエラー、キー入力エラーなど、複数のシナリオを検証する。
  - `anvil.test.ts`: `foundry`のAnvilがローカルで起動している場合にのみ実行される。実際のトランザクション送信、Nonce競合のシミュレーション、マイニング確認など、より現実に近いシナリオをテストする。

## 9. エラーハンドリング戦略
- `src/utils/errors.ts`: `InvalidInputError`, `PrivateKeyError`, `FileAccessError`, `SigningError`, `NetworkError`, `BroadcastError`などのカスタムエラークラスを定義。
- `src/cli/cli.ts`: グローバルな`try...catch`ブロックでエラーを集約し、`handleCliError`関数でユーザーフレンドリーなメッセージを`stderr`に出力後、`process.exit(1)`で終了する。

## 10. 依存関係とビルドプロセス
- **依存関係**: `package.json`には`viem`, `zod`, `commander`などを`dependencies`に、`vitest`, `tsup`, `biome`などを`devDependencies`に定義。
- **ビルド (`tsup.config.ts`)**: `tsup`を使用して、`src/cli/cli.ts`をエントリーポイントに、Node.js互換の単一CJSファイルを`dist`ディレクトリに生成する。
- **リンター/フォーマッター (`biome.json`)**: `Biome`を使用してコードの一貫性を保ち、CIでチェックを強制する。

