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

/**
 * EIP-2930 アクセスリスト項目のスキーマ
 * @description ガス最適化のためのストレージアクセス事前宣言（EIP-1559ではオプション）
 */
export const AccessListItemSchema = z.object({
  address: EthereumAddressSchema,
  storageKeys: z.array(
    z.string().regex(/^0x[a-fA-F0-9]{64}$/, {
      message: '無効なストレージキー形式です。0xで始まる64文字の16進文字列である必要があります。',
    })
  ),
});
