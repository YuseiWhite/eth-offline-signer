import { z } from 'zod';

/**
 * Ethereumアドレスの検証スキーマ
 * @description 0xで始まる40文字の16進文字列を検証
 */
export const EthereumAddressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/, {
  message: '無効なEthereumアドレス形式です。0xで始まる40文字の16進文字列である必要があります。',
});
