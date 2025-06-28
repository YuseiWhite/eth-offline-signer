import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.hoisted()を使用してモック変数を定義
const mockReadFile = vi.hoisted(() => vi.fn());
const mockStat = vi.hoisted(() => vi.fn());
const mockResolve = vi.hoisted(() => vi.fn());
const mockBasename = vi.hoisted(() => vi.fn());
const mockPlatform = vi.hoisted(() => vi.fn());

// Node.jsモジュールのモック
vi.mock('node:fs/promises', () => ({
  default: {
    readFile: mockReadFile,
    stat: mockStat,
  },
  readFile: mockReadFile,
  stat: mockStat,
}));

vi.mock('node:path', () => ({
  default: {
    resolve: mockResolve,
    basename: mockBasename,
  },
  resolve: mockResolve,
  basename: mockBasename,
}));

vi.mock('node:os', () => ({
  default: {
    platform: mockPlatform,
  },
  platform: mockPlatform,
}));

import * as fs from 'node:fs/promises';
import { PrivateKeyFormatSchema } from '../../../src/types/schema';
import { loadPrivateKey } from '../../../src/core/keyManager';
import { FileAccessError, PrivateKeyError } from '../../../src/utils/errors';

describe('keyManager', () => {
  describe('loadPrivateKey', () => {
    const testKeyFilePath = '/test/path/test.key';
    // 正確に64文字（32バイト）の有効な秘密鍵
    const validPrivateKey = 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
    const validPrivateKeyWithPrefix = '0x' + validPrivateKey;
    const validPrivateKeyWithoutPrefix = validPrivateKey;

    beforeEach(() => {
      vi.clearAllMocks();

      // デフォルトのモック設定
      mockResolve.mockReturnValue(testKeyFilePath);
      mockBasename.mockReturnValue('test.key');
      mockPlatform.mockReturnValue('linux');
      mockStat.mockResolvedValue({ mode: 0o100400 });
      mockReadFile.mockResolvedValue(validPrivateKeyWithPrefix);
    });

    describe('正常系', () => {
      it('有効な秘密鍵ファイル（0xプレフィックス付き）を正常に読み込む', async () => {
        const result = await loadPrivateKey('test.key');
        expect(result.privateKey).toBe(validPrivateKeyWithPrefix);
        expect(result.cleanup).toBeDefined();
      });

      it('有効な秘密鍵ファイル（0xプレフィックスなし）を正常に読み込み、プレフィックスを追加', async () => {
        mockReadFile.mockResolvedValue(validPrivateKeyWithoutPrefix);

        const result = await loadPrivateKey('test.key');
        expect(result.privateKey).toBe(validPrivateKeyWithPrefix); // 0xプレフィックスが追加される
        expect(result.cleanup).toBeDefined();
      });

      it('前後の空白を含む秘密鍵ファイルを正常に処理', async () => {
        mockReadFile.mockResolvedValue(`  ${validPrivateKeyWithPrefix}  \n`);

        const result = await loadPrivateKey('test.key');
        expect(result.privateKey).toBe(validPrivateKeyWithPrefix);
        expect(result.cleanup).toBeDefined();
      });

      it('cleanup関数が正常に動作する', async () => {
        const result = await loadPrivateKey('test.key');
        expect(result.privateKey).toBe(validPrivateKeyWithPrefix);

        const cleanupFn = result.cleanup as () => void;
        cleanupFn();
        expect(() => result.privateKey).toThrow('秘密鍵が既にクリーンアップされています。');
      });
    });

    describe('パーミッションチェック', () => {
      it('POSIX環境で400パーミッションの場合は警告なし', async () => {
        mockPlatform.mockReturnValue('linux');
        mockStat.mockResolvedValue({ mode: 0o100400 });

        const result = await loadPrivateKey('test.key');
        expect(result.privateKey).toBe(validPrivateKeyWithPrefix);
      });

      it('POSIX環境で400以外のパーミッションの場合は警告を出力', async () => {
        mockPlatform.mockReturnValue('linux');
        mockStat.mockResolvedValue({ mode: 0o100644 }); // 644パーミッション
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const result = await loadPrivateKey('test.key');
        expect(result.privateKey).toBe(validPrivateKeyWithPrefix);
        expect(warnSpy).toHaveBeenCalledWith(
          expect.stringContaining('⚠️  秘密鍵ファイルのパーミッションが安全ではありません。')
        );
      });

      it('Windows環境ではパーミッションチェックをスキップ', async () => {
        // process.platformを一時的にwin32に変更
        const originalPlatform = process.platform;
        Object.defineProperty(process, 'platform', { value: 'win32' });
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const result = await loadPrivateKey('test.key');
        expect(result.privateKey).toBe(validPrivateKeyWithPrefix);
        expect(warnSpy).toHaveBeenCalledWith(
          expect.stringContaining(
            '⚠️  Windows環境では、ファイルが適切に保護されていることを手動で確認してください:'
          )
        );
        // process.platformを元に戻す
        Object.defineProperty(process, 'platform', { value: originalPlatform });
      });
    });

    describe('異常系 - 入力バリデーション', () => {
      it('空文字列のファイルパスでエラー', async () => {
        await expect(loadPrivateKey('')).rejects.toThrow(PrivateKeyError);
        await expect(loadPrivateKey('')).rejects.toThrow(
          '秘密鍵ファイルのパスが指定されていません。'
        );
      });

      it('undefinedのファイルパスでエラー', async () => {
        await expect(loadPrivateKey(undefined as any)).rejects.toThrow(PrivateKeyError);
        await expect(loadPrivateKey(undefined as any)).rejects.toThrow(
          '秘密鍵ファイルのパスが指定されていません。'
        );
      });

      it('nullのファイルパスでエラー', async () => {
        await expect(loadPrivateKey(null as any)).rejects.toThrow(PrivateKeyError);
        await expect(loadPrivateKey(null as any)).rejects.toThrow(
          '秘密鍵ファイルのパスが指定されていません。'
        );
      });

      it('拡張子が.keyでないファイルパスでエラー', async () => {
        await expect(loadPrivateKey('file.txt')).rejects.toThrow(PrivateKeyError);
        await expect(loadPrivateKey('file.txt')).rejects.toThrow(
          '秘密鍵ファイルは.key拡張子である必要があります'
        );
      });
    });

    describe('異常系 - ファイルアクセスエラー', () => {
      it('ファイルが存在しない場合のエラー', async () => {
        const enoentError = new Error('ENOENT: no such file or directory');
        (enoentError as any).code = 'ENOENT';
        mockReadFile.mockRejectedValue(enoentError);

        await expect(loadPrivateKey('nonexistent.key')).rejects.toThrow(FileAccessError);
        await expect(loadPrivateKey('nonexistent.key')).rejects.toThrow(
          '秘密鍵ファイルが見つかりません'
        );
      });

      it('ファイル読み込み権限エラー', async () => {
        const eaccessError = new Error('EACCES: permission denied');
        (eaccessError as any).code = 'EACCES';
        mockReadFile.mockRejectedValue(eaccessError);

        await expect(loadPrivateKey('test.key')).rejects.toThrow(FileAccessError);
        await expect(loadPrivateKey('test.key')).rejects.toThrow('の読み込みに失敗しました');
      });

      it('一般的なファイル読み込みエラー', async () => {
        const genericError = new Error('Generic file error');
        mockReadFile.mockRejectedValue(genericError);

        await expect(loadPrivateKey('test.key')).rejects.toThrow(FileAccessError);
        await expect(loadPrivateKey('test.key')).rejects.toThrow('の読み込みに失敗しました');
      });

      it('パーミッションチェック中のエラー', async () => {
        const statError = new Error('Permission denied during stat');
        mockStat.mockRejectedValue(statError);

        await expect(loadPrivateKey('test.key')).rejects.toThrow(FileAccessError);
      });

      it('不明なステータスエラーで一般的なFileAccessErrorを投げる', async () => {
        // stat throws unknown error code
        mockStat.mockRejectedValue({ code: 'OTHER', message: 'other error' });
        await expect(loadPrivateKey('test.key')).rejects.toThrow(FileAccessError);
        await expect(loadPrivateKey('test.key')).rejects.toThrow(
          /ファイルアクセスエラー: other error/
        );
      });
    });

    describe('異常系 - 秘密鍵バリデーション', () => {
      it('空の秘密鍵でエラー', async () => {
        mockReadFile.mockResolvedValue('');

        await expect(loadPrivateKey('test.key')).rejects.toThrow(PrivateKeyError);
        await expect(loadPrivateKey('test.key')).rejects.toThrow('秘密鍵が空です。');
      });

      it('空白のみの秘密鍵でエラー', async () => {
        mockReadFile.mockResolvedValue('   \n\t  ');

        await expect(loadPrivateKey('test.key')).rejects.toThrow(PrivateKeyError);
        await expect(loadPrivateKey('test.key')).rejects.toThrow('秘密鍵が空です。');
      });

      it('短すぎる秘密鍵でエラー', async () => {
        const shortKey = '0x123456'; // 8文字: 0x + 6文字
        mockReadFile.mockResolvedValue(shortKey);

        await expect(loadPrivateKey('test.key')).rejects.toThrow(PrivateKeyError);
        await expect(loadPrivateKey('test.key')).rejects.toThrow(
          '無効な秘密鍵形式です。秘密鍵は64文字の16進数文字列である必要があります'
        );
      });

      it('長すぎる秘密鍵でエラー', async () => {
        const longKey = '0x' + 'a'.repeat(70); // 70文字（64文字より長い）
        mockReadFile.mockResolvedValue(longKey);

        await expect(loadPrivateKey('test.key')).rejects.toThrow(PrivateKeyError);
        await expect(loadPrivateKey('test.key')).rejects.toThrow(
          '無効な秘密鍵形式です。秘密鍵は64文字の16進数文字列である必要があります'
        );
      });

      it('無効な16進文字を含む秘密鍵でエラー', async () => {
        const invalidKey = '0x' + 'g'.repeat(64); // 'g'は16進文字ではない
        mockReadFile.mockResolvedValue(invalidKey);

        await expect(loadPrivateKey('test.key')).rejects.toThrow(PrivateKeyError);
        await expect(loadPrivateKey('test.key')).rejects.toThrow(
          '無効な秘密鍵形式です。秘密鍵は64文字の16進数文字列である必要があります'
        );
      });

      it('0xプレフィックスなしで無効な文字を含む秘密鍵でエラー', async () => {
        const invalidKey = 'g'.repeat(64); // 'g'は16進文字ではない
        mockReadFile.mockResolvedValue(invalidKey);

        await expect(loadPrivateKey('test.key')).rejects.toThrow(PrivateKeyError);
        await expect(loadPrivateKey('test.key')).rejects.toThrow(
          '無効な秘密鍵形式です。秘密鍵は64文字の16進数文字列である必要があります'
        );
      });

      it('不正な16進数形式の秘密鍵でエラー', async () => {
        // 長さ不足ではなくフォーマット不正として処理されるケース
        mockReadFile.mockResolvedValue(
          'zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz'
        );

        await expect(loadPrivateKey('test.key')).rejects.toThrow(PrivateKeyError);
        await expect(loadPrivateKey('test.key')).rejects.toThrow(
          '無効な秘密鍵形式です。秘密鍵は64文字の16進数文字列である必要があります'
        );
      });
    });

    describe('エッジケース', () => {
      it('大文字の16進文字を含む秘密鍵を正常に処理', async () => {
        const upperCaseKey = '0xABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890';
        mockReadFile.mockResolvedValue(upperCaseKey);

        const result = await loadPrivateKey('test.key');
        expect(result.privateKey).toBe(upperCaseKey);
        expect(result.cleanup).toBeDefined();
      });

      it('混合大小文字の16進文字を含む秘密鍵を正常に処理', async () => {
        const mixedCaseKey = '0xAbCdEf1234567890aBcDeF1234567890AbCdEf1234567890aBcDeF1234567890';
        mockReadFile.mockResolvedValue(mixedCaseKey);

        const result = await loadPrivateKey('test.key');
        expect(result.privateKey).toBe(mixedCaseKey);
        expect(result.cleanup).toBeDefined();
      });

      it('複数回cleanup()を呼び出しても安全', async () => {
        const result = await loadPrivateKey('test.key');

        const cleanupFn2 = result.cleanup as () => void;
        cleanupFn2();
        cleanupFn2();
        cleanupFn2();

        const cleanupFn3 = result.cleanup as () => void;
        expect(() => cleanupFn3()).not.toThrow();
      });

      it('cleanup後のprivateKeyアクセスは常にエラー', async () => {
        const result = await loadPrivateKey('test.key');
        const cleanupFn4 = result.cleanup as () => void;
        cleanupFn4();

        // cleanup後のアクセスはエラー
        expect(() => result.privateKey).toThrow('秘密鍵が既にクリーンアップされています');
      });
    });

    describe('予期しないエラーの処理', () => {
      it('予期しないエラーをFileAccessErrorとして再スロー', async () => {
        const unexpectedError = new TypeError('Unexpected error');
        mockReadFile.mockRejectedValue(unexpectedError);

        await expect(loadPrivateKey('test.key')).rejects.toThrow(FileAccessError);
        await expect(loadPrivateKey('test.key')).rejects.toThrow('の読み込みに失敗しました');
      });
    });

    describe('メモリセキュリティ', () => {
      it('SecureKeyStorageが適切にメモリをクリア', async () => {
        const result = await loadPrivateKey('test.key');

        // 初期状態では秘密鍵にアクセス可能
        expect(result.privateKey).toBe(validPrivateKeyWithPrefix);

        // cleanup実行
        const cleanupFn6 = result.cleanup as () => void;
        cleanupFn6();

        // cleanup後は秘密鍵にアクセス不可
        expect(() => result.privateKey).toThrow('秘密鍵が既にクリーンアップされています');
      });

      it('エラー時でもメモリがクリーンアップされる', async () => {
        // 無効な秘密鍵を設定してエラーを発生させる
        mockReadFile.mockResolvedValue('invalid-key');

        try {
          await loadPrivateKey('test.key');
          expect.fail('エラーが発生するはずです');
        } catch (error) {
          expect(error).toBeInstanceOf(PrivateKeyError);
          // メモリクリーンアップが実行されていることを確認
          // （実際のメモリ状態は直接検証できないが、エラーハンドリングが正常に動作することを確認）
        }
      });
    });
  });
});

// internal keyManager error tests merged from keyManager.internal.test.ts
describe('keyManager internal error cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loadPrivateKey edge cases', () => {
    it('should throw PrivateKeyError for undefined keyFile', async () => {
      await expect(loadPrivateKey(undefined as any)).rejects.toThrow(PrivateKeyError);
      await expect(loadPrivateKey(undefined as any)).rejects.toThrow(
        '秘密鍵ファイルのパスが指定されていません'
      );
    });

    it('should throw PrivateKeyError for null keyFile', async () => {
      await expect(loadPrivateKey(null as any)).rejects.toThrow(PrivateKeyError);
      await expect(loadPrivateKey(null as any)).rejects.toThrow(
        '秘密鍵ファイルのパスが指定されていません'
      );
    });

    it('should throw PrivateKeyError for empty string keyFile', async () => {
      await expect(loadPrivateKey('')).rejects.toThrow(PrivateKeyError);
      await expect(loadPrivateKey('')).rejects.toThrow('秘密鍵ファイルのパスが指定されていません');
    });

    it('should throw PrivateKeyError for whitespace-only keyFile', async () => {
      await expect(loadPrivateKey('   ')).rejects.toThrow(PrivateKeyError);
      await expect(loadPrivateKey('   ')).rejects.toThrow(
        '秘密鍵ファイルのパスが指定されていません'
      );
    });

    it('should throw PrivateKeyError for invalid file extension', async () => {
      // This should trigger the ZodError handling in loadPrivateKeyFromFile (lines 86-87)
      await expect(loadPrivateKey('invalid-file.txt')).rejects.toThrow(PrivateKeyError);
      await expect(loadPrivateKey('invalid-file.txt')).rejects.toThrow(
        '秘密鍵ファイルは.key拡張子である必要があります'
      );
    });

    it('should handle non-ZodError during file path validation', async () => {
      // This would test the generic error handling (lines 98-99)
      const { FilePathSchema } = await import('../../../src/types/schema');
      const genericError = new Error('Generic validation error');
      const parseSpy = vi.spyOn(FilePathSchema, 'parse').mockImplementation(() => { throw genericError; });
      
      try {
        await expect(loadPrivateKey('test.key')).rejects.toThrow(genericError);
      } finally {
        parseSpy.mockRestore();
      }
    });
  });

  describe('validateFileAccess error cases', () => {
    it('should throw FileAccessError for ENOENT error', async () => {
      const enoentError = new Error('ENOENT: no such file or directory');
      (enoentError as any).code = 'ENOENT';
      vi.mocked(fs.stat).mockRejectedValue(enoentError);

      await expect(loadPrivateKey('nonexistent.key')).rejects.toThrow(FileAccessError);
      await expect(loadPrivateKey('nonexistent.key')).rejects.toThrow(
        '秘密鍵ファイルが見つかりません'
      );
    });

    it('should throw FileAccessError for EACCES error', async () => {
      const eaccesError = new Error('EACCES: permission denied');
      (eaccesError as any).code = 'EACCES';
      vi.mocked(fs.stat).mockRejectedValue(eaccesError);

      await expect(loadPrivateKey('noaccess.key')).rejects.toThrow(FileAccessError);
      await expect(loadPrivateKey('noaccess.key')).rejects.toThrow(
        '秘密鍵ファイルの読み取り権限がありません'
      );
    });

    it('should throw FileAccessError for other file errors', async () => {
      const otherError = new Error('EIO: input/output error');
      (otherError as any).code = 'EIO';
      vi.mocked(fs.stat).mockRejectedValue(otherError);

      await expect(loadPrivateKey('ioerror.key')).rejects.toThrow(FileAccessError);
      await expect(loadPrivateKey('ioerror.key')).rejects.toThrow('ファイルアクセスエラー');
    });
  });

  describe('file read error cases', () => {
    it('should throw FileAccessError for ENOENT during readFile', async () => {
      vi.mocked(fs.stat).mockResolvedValue({} as any);
      const enoentError = new Error('ENOENT: no such file or directory');
      (enoentError as any).code = 'ENOENT';
      vi.mocked(fs.readFile).mockRejectedValue(enoentError);

      await expect(loadPrivateKey('disappearing.key')).rejects.toThrow(FileAccessError);
      await expect(loadPrivateKey('disappearing.key')).rejects.toThrow(
        '秘密鍵ファイルが見つかりません'
      );
    });

    it('should throw FileAccessError for other readFile errors', async () => {
      vi.mocked(fs.stat).mockResolvedValue({} as any);
      const readError = new Error('Read failed');
      vi.mocked(fs.readFile).mockRejectedValue(readError);

      await expect(loadPrivateKey('read-error.key')).rejects.toThrow(FileAccessError);
      await expect(loadPrivateKey('read-error.key')).rejects.toThrow(
        '秘密鍵ファイルの読み込みに失敗しました'
      );
    });
  });

  describe('normalizePrivateKey error cases', () => {
    beforeEach(() => {
      vi.mocked(fs.stat).mockResolvedValue({} as any);
    });

    it('should throw PrivateKeyError for empty file content', async () => {
      vi.mocked(fs.readFile).mockResolvedValue('');

      await expect(loadPrivateKey('empty.key')).rejects.toThrow(PrivateKeyError);
      await expect(loadPrivateKey('empty.key')).rejects.toThrow('秘密鍵が空です');
    });

    it('should throw PrivateKeyError for whitespace-only content', async () => {
      vi.mocked(fs.readFile).mockResolvedValue('   \n  \t  ');

      await expect(loadPrivateKey('whitespace.key')).rejects.toThrow(PrivateKeyError);
      await expect(loadPrivateKey('whitespace.key')).rejects.toThrow('秘密鍵が空です');
    });

    it('should throw PrivateKeyError for invalid hex characters', async () => {
      vi.mocked(fs.readFile).mockResolvedValue('0xgg' + 'a'.repeat(62));

      await expect(loadPrivateKey('invalid-hex.key')).rejects.toThrow(PrivateKeyError);
      await expect(loadPrivateKey('invalid-hex.key')).rejects.toThrow('無効な秘密鍵形式です');
    });

    it('should throw PrivateKeyError for wrong length key', async () => {
      vi.mocked(fs.readFile).mockResolvedValue('0x' + 'a'.repeat(30)); // too short

      await expect(loadPrivateKey('short.key')).rejects.toThrow(PrivateKeyError);
      await expect(loadPrivateKey('short.key')).rejects.toThrow('無効な秘密鍵形式です');
    });

    it('should handle non-ZodError during normalization', async () => {
      vi.mocked(fs.readFile).mockResolvedValue('some-other-error-trigger');
      await expect(loadPrivateKey('other-error.key')).rejects.toThrow(PrivateKeyError);
    });

    it('should convert generic normalization error to PrivateKeyError', async () => {
      // simulate generic error during normalization
      const genericError = new Error('generic');
      const parseSpy = vi.spyOn(PrivateKeyFormatSchema, 'parse').mockImplementation(() => { throw genericError; });
      // valid private key to reach normalization step
      const validKey = '0x' + 'a'.repeat(64);
      vi.mocked(fs.readFile).mockResolvedValue(validKey);
      // override process.platform for permission check
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'linux' });
      await expect(loadPrivateKey('test.key')).rejects.toThrow(PrivateKeyError);
      await expect(loadPrivateKey('test.key')).rejects.toThrow('秘密鍵の形式が無効です。generic');
      // restore platform and spy
      Object.defineProperty(process, 'platform', { value: originalPlatform });
      parseSpy.mockRestore();
    });
  });

  describe('PrivateKeyHandle cleanup functionality', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      vi.mocked(fs.stat).mockResolvedValue({} as any);
      vi.mocked(fs.readFile).mockResolvedValue('0x' + 'a'.repeat(64));
    });

    it('should provide working cleanup function', async () => {
      const handle = await loadPrivateKey('valid.key');

      // Should access privateKey before cleanup
      expect(handle.privateKey).toBe('0x' + 'a'.repeat(64));

      // Call cleanup
      const cleanupFn = handle.cleanup as () => void;
      cleanupFn();

      // Should throw after cleanup
      expect(() => handle.privateKey).toThrow(PrivateKeyError);
      expect(() => handle.privateKey).toThrow('秘密鍵が既にクリーンアップされています');
    });

    it('should handle multiple cleanup calls gracefully', async () => {
      const handle = await loadPrivateKey('valid.key');

      // Call cleanup multiple times
      const cleanupFn = handle.cleanup as () => void;
      cleanupFn();
      cleanupFn();
      cleanupFn();

      // Should still throw appropriate error when accessing privateKey
      expect(() => handle.privateKey).toThrow(PrivateKeyError);
    });
  });

  describe('normalizePrivateKey with 0x prefix handling', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      vi.mocked(fs.stat).mockResolvedValue({} as any);
    });

    it('should add 0x prefix when missing', async () => {
      const keyWithoutPrefix = 'a'.repeat(64);
      vi.mocked(fs.readFile).mockResolvedValue(keyWithoutPrefix);

      const handle = await loadPrivateKey('no-prefix.key');
      expect(handle.privateKey).toBe('0x' + 'a'.repeat(64));
    });

    it('should preserve 0x prefix when present', async () => {
      const keyWithPrefix = '0x' + 'b'.repeat(64);
      vi.mocked(fs.readFile).mockResolvedValue(keyWithPrefix);

      const handle = await loadPrivateKey('with-prefix.key');
      expect(handle.privateKey).toBe('0x' + 'b'.repeat(64));
    });

    it('should trim whitespace before processing', async () => {
      const keyWithWhitespace = `  \n  0x${'c'.repeat(64)}  \n  `;
      vi.mocked(fs.readFile).mockResolvedValue(keyWithWhitespace);

      const handle = await loadPrivateKey('whitespace.key');
      expect(handle.privateKey).toBe('0x' + 'c'.repeat(64));
    });
  });
});
