# ADR Indexer

このファイルは、プロジェクトのArchitecture Decision Record (ADR) の一覧とその概要を提供します。

## ADR一覧

| ID | Title | Status | Context | Decision | Details Path |
|----|-------|--------|---------|----------|--------------|
| 001 | CI/CD Pipeline Simplification | accepted | コーディングテスト用途のプロジェクトに対して過剰なCI/CD複雑性の問題 | Performance/Metrics監視を削除し、必要最小限の品質ゲートを維持 | [001-ci-pipeline.md](./001-ci-pipeline.md) |
| 002 | TypeScript Comment Strategy | accepted | 一貫性のないコメント記述による可読性・保守性の問題 | 階層化ドキュメント戦略とJSDoc形式による最小限効果的コメントを採用 | [002-comment-strategy.md](./002-comment-strategy.md) |
| 003 | Dual Package Strategy | accepted | 不適切なexports設定によるESMコンシューマーでのモジュール解決エラー | デュアルパッケージ戦略でCJS/ESM両方を提供し完全互換性を実現 | [003-dual-package-strategy.md](./003-dual-package-strategy.md) |
| 004 | Orchestrator Pattern Private Key Management | accepted | 秘密鍵管理でのセキュリティ、可読性、テスト容易性の同時実現要件 | Orchestrator PatternとSecureKeyStorageによる階層化アーキテクチャを採用 | [004-private-key-management.md](./004-private-key-management.md) |
| 005 | Layered Architecture Selection | accepted | プロダクト特性分析の結果、適切なアーキテクチャパターンの選択が必要 | 過剰設計を避け層状アーキテクチャを採用、関数ベース実装で保守性とテスト性を確保 | [005-layered-architecture-selection.md](./005-layered-architecture-selection.md) |
| 006 | Ethereum Transaction Format Selection | accepted | プロジェクト要件に適合する最適なEthereumトランザクション形式の選定が必要 | 学習効果と技術的標準性を重視し、EIP-1559を実装対象として選定 | [006-eth-transaction-format.md](./006-eth-transaction-format.md) |
| 007 | Container Virtualization Technology Selection | accepted | コンテナ化技術の選択によるパフォーマンスとコストのバランスの最適化 | ハイパーバイザー型コンテナ化技術 OrbStack を選定 | [007-performance-vm-for-container.md](./007-performance-vm-for-container.md) |

## ADR作成ガイドライン

### 命名規則
- ファイル名: `{番号3桁}-{動詞で始まる簡潔な説明}.md`
- 例: `001-simplify-ci-pipeline.md`

### ステータス定義
- **proposed**: 提案中
- **accepted**: 承認済み
- **rejected**: 却下
- **deprecated**: 非推奨
- **superseded**: 置き換え済み

### 更新ルール
1. 既存ADRの内容は変更せず、新しいADRで置き換える
2. ステータス変更時はこのインデックスも更新する
3. 関連するドキュメントへのリンクを維持する 
