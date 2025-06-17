import { z } from 'zod';

/**
 * Ethereumアドレスの検証スキーマ
 * @description 0xで始まる40文字の16進文字列を検証
 */
export const EthereumAddressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/, {
  message: '無効なEthereumアドレス形式です。0xで始まる40文字の16進文字列である必要があります。',
});

/**
 * 数値文字列の検証スキーマ（wei、ガス価格等）
 * @description JavaScriptのnumber型では表現できない大きな数値を文字列として扱う
 */
export const NumericStringSchema = z.string().regex(/^\d+$/, {
  message: '無効な数値文字列です。数字のみを含む必要があります。',
});
