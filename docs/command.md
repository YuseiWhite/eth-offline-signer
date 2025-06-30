# 開発・テストコマンド

### ビルドコマンド

```bash
# 開発ビルド
pnpm run build

# 開発モード（ファイル監視）
pnpm run dev

# 型チェック
pnpm run typecheck

# 全体検証
pnpm run ci:verify
```

### テストコマンド

```bash
# 全テスト実行
pnpm test

# カバレッジ付きテスト
pnpm run test:coverage

# ミューテーションテスト
pnpm run test:mutation
```

### コード品質

```bash
# Biomeリント（高速）
pnpm run lint

# 自動修正
pnpm run lint:fix

# フォーマット
pnpm run format

# アーキテクチャ検証
pnpm run check:arch
```

### CLIコマンド

`sign` コマンドは、秘密鍵とトランザクションパラメータをファイルから読み込み、オフラインで署名を実行します。

#### 基本的な使い方（オフライン署名）

秘密鍵（`.key`）とトランザクションデータ（`.json`）を用意し、以下のコマンドを実行します。

```bash
node dist/cli.cjs sign \
  --key-file ./path/to/your.key \
  --params ./path/to/tx-params.json
```

成功すると、署名済みのトランザクションデータ（16進数文字列）などが表示されます。

#### 署名とブロードキャスト

`--broadcast`フラグと`--rpc-url`を同時に指定すると、署名後にトランザクションをネットワークにブロードキャストします。

```bash
node dist/cli.cjs sign \
  --key-file ./path/to/your.key \
  --params ./path/to/tx-params.json \
  --broadcast \
  --rpc-url <your-rpc-provider-url>
```

成功すると、トランザクションハッシュなどの結果が表示されます。

---

### オプション一覧

| オプション | エイリアス | 説明 | 必須 |
|:---|:---|:---|:---:|
| `--key-file <path>` | `-k` | 秘密鍵が含まれるファイルへのパス。（例: `./private.key`） | 必須 |
| `--params <path>` | `-p` | トランザクションパラメータが含まれるJSONファイルへのパス。 | 必須 |
| `--broadcast` | | 署名後にトランザクションをブロードキャストします。`--rpc-url`が必須です。 | |
| `--rpc-url <url>` | | ブロードキャストに使用するRPCエンドポイントのURL。`params.json`内の`chainId`と一致するネットワークを指定する必要があります。 | |
| `--quiet` | `-q` | 成功時に署名データまたはTxハッシュのみを出力し、途中のログを抑制します。 | |
| `--version` | `-v` | バージョン情報を表示します。 | |
| `--help` | `-h` | ヘルプメッセージを表示します。 | |

---

### パラメータJSONファイルの例

`--params`で指定するJSONファイルの形式です。
**注意: 以下の値はあくまでサンプルです。実際のトランザクションに合わせて適切な値を設定してください。**

```json
{
  "to": "0xRecipientAddress...",
  "value": "10000000000000000",
  "chainId": 11155111,
  "nonce": 0,
  "gasLimit": "21000",
  "maxFeePerGas": "30000000000",
  "maxPriorityFeePerGas": "2000000000",
  "accessList": []
}
```

- **`value`**: 送金額を **Wei** 単位で指定します (例: 0.01 ETH は `"10000000000000000"`)。
- **`gasLimit`**: ガスリミットを **Wei** 単位で指定します。
- **`maxFeePerGas`**: 1ガスあたりの最大手数料を **Wei** 単位で指定します。
- **`maxPriorityFeePerGas`**: 1ガスあたりの最大優先手数料（マイナーチップ）を **Wei** 単位で指定します。
- **`to`**: 受信者のEthereumアドレスです。
- **`chainId`**: ターゲットネットワークのチェーンIDです。
- **`nonce`**: 送信者アドレスのトランザクション数です。
- **`accessList`**: EIP-2930のアクセスリストです。通常は空配列`[]`で問題ありません。
