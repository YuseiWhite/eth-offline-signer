# eth-offline-signer

eth-offline-signerは、Ethereumトランザクション（EIP-1559形式）を完全にオフライン環境で署名し、オプションでネットワークにブロードキャストするためのCLIです。秘密鍵をネットワークに晒すことなく、安全にトランザクションに署名でき、必要に応じて直接ブロードキャストしてトランザクションハッシュからエクスプローラーリンクで詳細を確認することができます。

### 主な特徴

- **完全オフライン署名**: viemベースでのネットワーク接続不要の安全な署名
- **EIP-1559に対応**: Type 2トランザクション、maxFeePerGas/maxPriorityFeePerGasに対応
- **オプション ブロードキャスト**: 署名後の自動ネットワーク送信
- **インテリジェント リトライ**: Nonce競合の自動解決とエクスポネンシャルバックオフ
- **マルチネットワーク対応**: Sepolia、Hoodi、Anvilを自動サポート
- **型安全性**: TypeScript + Zod による厳密な型検証
- **階層アーキテクチャ**: 4層アーキテクチャによる保守性とテスト性
- **セキュリティ**: ファイル権限チェック、メモリクリーンアップ、入力サニタイズ
- **高品質コード**: 100%テストカバレッジ

### サポートネットワーク

| ネットワーク | チェーンID | 自動RPC | エクスプローラー |
|-------------|-----------|---------|-----------------|
| **Sepolia** | `11155111` | ✅ | https://sepolia.etherscan.io |
| **Hoodi** | `560048` | ✅ | https://hoodi.etherscan.io |
| **Anvil（推奨）** | `31337` | ✅ | ローカル |

### インストール手順

1. 必要環境

   - **Node.js**: 18.0.0 以上
   - **pnpm**: 9.0.0 以上（推奨）
   - **OS**: Linux、macOS、Windows対応

2. リポジトリをクローン

    ```bash
    git clone https://github.com/YuseiWhite/eth-offline-signer.git
    ```

3. eth-offline-signerに移動

    ``` bash
    cd eth-offline-signer
    ```

4. pnpmでのモジュールをインストール（推奨）

    ```bash
    pnpm install
    ```

5. ビルド（CJS/ESM対応）

    ```bash
    pnpm run build
    ```

### クイックスタート

1. 基本コマンド確認

    ```bash
    # ヘルプ表示
    node dist/cli.cjs --help

    # バージョン確認
    node dist/cli.cjs --version
    ```

2. 秘密鍵ファイル準備

    ```bash
    # 秘密鍵ファイル作成（64文字の16進文字列、0xプレフィックス無し）
    echo <your-private-key> > private.key

    # セキュリティのため権限を制限（必須）
    chmod 400 private.key
    ```

3. トランザクションパラメータファイル作成

    ```bash
    # EIP-1559トランザクションパラメータ
    cat > transaction.json << 'EOF'
    {
        "to": "<receiver's address>",
        "value": "<value-you-want-to-transfer(wei)>",
        "chainId": <chain-id>,
        "nonce": <nonce>,
        "gasLimit": "<wei>",
        "maxFeePerGas": "<wei>",
        "maxPriorityFeePerGas": "<wei>"
    }
    EOF
    ```

- パターン1: オフライン署名のみ（ネットワーク接続不要）

    - 通常の実行
       ```bash
       node dist/cli.cjs sign --key-file private.key --params transaction.json
       ```
   
       ```bash
       # 実行ログ (stderr):
       使用するアドレス: 0x...
       トランザクションの署名を開始...
       署名完了
オフライン署名のみ完了しました。ブロードキャストはスキップされます。
   
       # 標準出力 (stdout):
       0x12345...
       ```

    - quietモード
       ```bash
       node dist/cli.cjs sign --key-file private.key --params transaction.json --quiet
       ```
   
       ```bash
       # 標準出力 (stdout):
       0x12345...
       ```

- パターン2: 署名 + 自動ブロードキャスト（推奨）

    - 通常の実行
       ```bash
       node dist/cli.cjs sign --key-file private.key --params transaction.json --broadcast --rpc-url https://...
       ```
   
       ```bash
       # 実行ログ (stderr):
       検出されたネットワーク: Sepolia (Chain ID: 11155111)
       対応エクスプローラー: https://sepolia.etherscan.io
       使用するアドレス: 0x...
       トランザクションの署名を開始...
       署名完了
       トランザクションのブロードキャストを開始...
       トランザクションのマイニング完了を待機中...
       トランザクションハッシュ: 0x1234...
       ブロック番号: 1234567
       ガス使用量: 21000
       エクスプローラーURL: https://sepolia.etherscan.io/tx/0x1234...
   
       # 標準出力 (stdout):
       0x12345...
       ```

    - quietモード
       ```bash 
       node dist/cli.cjs sign -k private.key -p transaction.json -b --rpc-url https://... -q
       ```
   
       ```bash
       # 標準出力 (stdout):
       0x12345...
       ```

- Anvilローカルネットワークでの実行（Docker開発環境の場合）

    `compose.yml`で定義された開発環境でAnvilに対して実行する場合、ホストから以下のコマンドを使用してください。`signer-dev`コンテナ内でCLIが実行され、`anvil`サービスに接続します。

    ```bash
    docker exec signer-dev node dist/cli.cjs sign -k private.key -p transaction.json --broadcast --rpc-url http://anvil:8545
    ```

### コマンドオプション

| オプション | 短縮形 | 必須 | 説明 |
|-----------|-------|------|------|
| `--key-file <path>` | `-k` | はい | 秘密鍵ファイルパス（.key拡張子必須） |
| `--params <path>` | `-p` | はい | トランザクションパラメータJSONファイル |
| `--broadcast` | - | いいえ | 署名後に自動ブロードキャスト |
| `--rpc-url <url>` | - | ※ | カスタムRPCエンドポイント |
| `--quiet` | `-q` | いいえ | 成功時のログを抑制し、結果のみ出力 |

※ `--broadcast`使用時は必須

### テストカバレッジ

- **ユニットテスト**: 473テスト（100%成功）
- **統合テスト**: 11テスト（100%成功）
- **E2Eテスト**: CLI統合、Anvilローカル環境
- **総合カバレッジ**: 45/45テスト（100%成功）


### トラブルシューティング

#### よくある問題

1. ファイル権限エラー

    ```bash
    入力エラー: 秘密鍵ファイルは.key拡張子である必要があります
    ```

    **解決方法:**
    ```bash
    # 正しい拡張子に変更
    mv private.txt private.key
    chmod 400 private.key
    ```

2. Nonce競合エラー

    ```bash
    ブロードキャストエラー: nonce too low
    ```

    **解決方法:**
    - 自動リトライが3回実行されます
    - 手動でnonceを増加させてください

3. RPC接続エラー

    ```bash
    ネットワークエラー: fetch failed
    ```

    **解決方法:**
    ```bash
    # RPC URLの確認
    curl -X POST -H "Content-Type: application/json" -d '{"method":"eth_chainId","params":[],"id":1,"jsonrpc":"2.0"}' https://your-rpc-url.com
    ```

2. ガス不足エラー

    ```bash
    ブロードキャストエラー: insufficient funds for gas
    ```

    **解決方法:**
    - ガス価格を上げる
    - アカウント残高を確認
    - gasLimitを調整

### ライセンス

MIT License

### 技術的な詳細
- [アーキテクチャ](docs/architecture.md)
- [ビルドコマンド / テストコマンド](docs/command.md)
- [セキュリティ機能](docs/security.md)
- [技術仕様](docs/technical-specification.md)
- [テストカバレッジ](docs/test-coverage.md)
