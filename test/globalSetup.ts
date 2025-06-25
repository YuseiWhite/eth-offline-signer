import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';

let anvilProcess: ChildProcess | undefined;

/**
 * 🔧 Anvil グローバルセットアップ
 * テスト実行前にAnvilプロセスを自動起動し、終了時に確実にクリーンアップ
 */
export async function setup(): Promise<void> {
  // Anvilのインストール確認
  try {
    await checkAnvilInstallation();
    console.info('🚀 Starting Anvil for integration tests...');

    anvilProcess = spawn('anvil', ['--port', '8545', '--host', '0.0.0.0'], {
      stdio: 'pipe', // ログを静かに
      detached: false,
    });

    // Anvilの起動待機（最大10秒）
    await waitForAnvil(10000);
    console.info('✅ Anvil started successfully');
  } catch (error) {
    console.warn('⚠️ Anvil not available, integration tests will be skipped');
    console.warn(`Reason: ${error}`);
    // エラーでもテスト続行（スキップで対応）
  }
}

export async function teardown(): Promise<void> {
  if (anvilProcess && !anvilProcess.killed) {
    console.info('🛑 Stopping Anvil...');
    anvilProcess.kill('SIGTERM');

    // プロセス終了待機（最大5秒）
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        if (anvilProcess && !anvilProcess.killed) {
          anvilProcess.kill('SIGKILL'); // 強制終了
        }
        resolve();
      }, 5000);

      anvilProcess?.on('exit', () => {
        clearTimeout(timeout);
        resolve();
      });
    });

    console.info('✅ Anvil stopped');
  }
}

/**
 * Anvilのインストール確認
 */
async function checkAnvilInstallation(): Promise<void> {
  return new Promise((resolve, reject) => {
    const { spawn } = require('node:child_process');
    const child = spawn('anvil', ['--version'], { stdio: 'pipe' });

    child.on('error', () => {
      reject(
        new Error(
          'Anvil is not installed. Install with: curl -L https://foundry.paradigm.xyz | bash && foundryup'
        )
      );
    });

    child.on('exit', (code: number | null) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error('Anvil installation check failed'));
      }
    });
  });
}

/**
 * Anvilの可用性を確認
 */
async function waitForAnvil(timeoutMs: number): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    try {
      const response = await fetch('http://localhost:8545', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_chainId',
          params: [],
          id: 1,
        }),
      });

      if (response.ok) {
        return; // 成功
      }
    } catch {
      // 接続失敗、再試行
    }

    await new Promise((resolve) => setTimeout(resolve, 500)); // 0.5秒待機
  }

  throw new Error('Anvil startup timeout');
}
