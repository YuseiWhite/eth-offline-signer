## Orchestrator Pattern による秘密鍵管理アーキテクチャ

<b>日時: 2025-06-17</b>

### ステータス (Status)
承認済み (accepted)

### 背景 (Context)
JavaScript/TypeScriptにおける秘密鍵管理では、セキュリティ、可読性、テスト容易性を同時に満たす必要がある。特にviem（Ethereum JavaScript SDK）の制約下では、`privateKeyToAccount(privateKey: '0x${string}')`が文字列型を要求するため、完全なメモリ隔離は不可能である。しかし、以下の要件を満たすアーキテクチャが必要：

1. **セキュリティ**: DoD 5220.22-M準拠のメモリ削除
2. **可読性**: 単一責任の原則による明確な関数分離
3. **テスト容易性**: 各機能の独立テスト可能性
4. **viem互換性**: 既存APIとの完全互換性維持
5. **保守性**: 将来的な機能拡張への対応

### 決定事項 (Decision)
Orchestrator Patternを採用し、SecureKeyStorageクラスとプライベートヘルパー関数による階層化アーキテクチャを実装する：

#### 1. **Orchestrator Function**
```typescript
export async function loadPrivateKey(keyFilePath: string): Promise<LoadPrivateKeyResult>
```
- 全体的なワークフローを管理
- 5つのヘルパー関数を順次実行
- エラーハンドリングとクリーンアップを統括

#### 2. **Helper Functions Architecture**
```typescript
// セキュリティチェック
async function checkKeyFilePermissions(keyFilePath: string): Promise<void>

// ファイルI/O
async function readPrivateKeyFile(keyFilePath: string): Promise<string>

// データ検証・正規化
function validateAndNormalizePrivateKey(privateKey: string): string

// 結果オブジェクト作成
function createPrivateKeyResult(secureStorage: SecureKeyStorage): LoadPrivateKeyResult

// メモリ管理補助
function forceGarbageCollection(): void // `--expose-gc` フラグが必要な場合がある
```

#### `forceGarbageCollection()` の注意点
`global.gc()` 関数は、Node.js が `--expose-gc` フラグ付きで起動された場合にのみ利用可能です。開発環境であっても、このフラグがないと `global.gc` は未定義となり、この機能は動作しません。本番環境での使用は推奨されません。

#### 3. **SecureKeyStorage Class**
```typescript
class SecureKeyStorage {
  private keyBuffer: Buffer | null = null;
  private isCleanedUp = false;

  store(key: string): void           // Buffer-only保存
  getKey(): `0x${string}`          // 使用時のみ文字列変換
  cleanup(): void                   // DoD準拠4パス削除
}
```

#### 4. **セキュリティ機能**
- **Buffer-only Storage**: 秘密鍵をBufferのみで保持
- **DoD 5220.22-M準拠削除**: 4パス（ゼロ→FF→ランダム→ゼロ）メモリオーバーライト
- **Try-Finally構文**: エラー時も確実なクリーンアップ
- **最小限露出**: viemが要求する瞬間のみ文字列として公開
- **状態管理**: isCleanedUpフラグによる二重削除防止

#### 5. **実行フロー**
```
loadPrivateKey() [Orchestrator]
├── 1. checkKeyFilePermissions()     // POSIX 400パーミッション確認
├── 2. readPrivateKeyFile()          // 非同期ファイル読み込み
├── 3. validateAndNormalizePrivateKey() // 検証と0xプレフィックス追加
├── 4. secureStorage.store()         // Buffer-only保存
├── 5. createPrivateKeyResult()      // 結果オブジェクト作成
└── finally: forceGarbageCollection() // 開発環境でのGC強制実行
```

### 比較した選択肢 (Options Considered)

#### 選択肢1: 単一の巨大関数
- **利点**: 実装が簡単、一箇所ですべての処理を管理
- **欠点**: テスト困難、可読性低下、保守性の問題
- **却下理由**: 単一責任の原則に違反、将来的な拡張が困難

#### 選択肢2: クラスベースの実装
- **利点**: オブジェクト指向的、状態管理が明確
- **欠点**: 過度な複雑性、このユースケースには過剰
- **却下理由**: 関数ベースで十分、不要な複雑性を導入

#### 選択肢3: 外部公開ヘルパー関数
- **利点**: 最大限の再利用性
- **欠点**: APIの複雑化、セキュリティリスクの増加
- **却下理由**: 内部実装の詳細を外部に露出するリスク

#### 選択肢4: Orchestrator Pattern + Private Helpers（採用）
- **利点**: 最適なバランス（セキュリティ、可読性、テスト容易性）
- **欠点**: 実装複雑性がやや増加
- **採用理由**: すべての要件を満たす最適解

### 結果 (Consequences)

#### より簡単になること
- **テスト作成**: 各ヘルパー関数を独立してテスト可能
- **コード理解**: 各関数の目的が明確で認知的負荷が軽減
- **保守性**: 変更時の影響範囲が限定的で修正が容易
- **セキュリティ監査**: メモリ管理が明確化され、セキュリティ評価が容易
- **機能拡張**: 新しいソース（環境変数、標準入力）からの読み込み追加が容易
- **デバッグ**: 問題の特定と修正が関数単位で可能

#### より困難になること
- **初期実装**: 単純な実装と比較して設計が複雑
- **ファイル構造**: ヘルパー関数の追加によりファイルサイズが増加
- **学習コスト**: 新しい開発者がアーキテクチャを理解する時間が必要

#### アーキテクチャの利点
- **単一責任原則**: 各関数が明確に定義された責任を持つ
- **関数型アプローチ**: 副作用を最小限に抑えた純粋関数の活用
- **階層化設計**: Orchestrator → Helper → Utility の明確な階層
- **エラー境界**: 各レイヤーでの適切なエラーハンドリング

#### viemライブラリ制約への対応
- **型制約対応**: `'0x${string}'`型要求への完全対応
- **互換性維持**: 既存のviem APIとの100%互換性
- **パフォーマンス最適化**: 使用時のみの文字列変換による最小限露出

#### セキュリティ強化の実現
- **メモリ残存時間短縮**: 秘密鍵のメモリ残存時間を大幅に短縮
- **DoD標準準拠**: 軍事レベルのメモリ削除標準を採用
- **多層防御**: Buffer保存、複数パス削除、状態管理の組み合わせ
- **監査容易性**: セキュリティ機能の検証が容易な構造 