import { z } from 'zod';
import { InvalidInputError } from '../utils/errors';

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

/**
 * EIP-1559 トランザクションパラメータスキーマ
 * @description EIP-1559専用フィールドのみを許可し、他のトランザクション種別のフィールドを排除
 */
export const EIP1559TxParamsSchema = z
  .object({
    to: EthereumAddressSchema,
    value: NumericStringSchema,
    chainId: z.number().int().positive({ message: 'chainIdは正の整数である必要があります。' }),
    nonce: z.number().int().nonnegative({ message: 'nonceは0以上の整数である必要があります。' }),
    gasLimit: NumericStringSchema,
    maxFeePerGas: NumericStringSchema,
    maxPriorityFeePerGas: NumericStringSchema,
    accessList: z.array(AccessListItemSchema).optional(),
  })
  .strict({ message: 'EIP-1559トランザクションで許可されていないフィールドが含まれています。' });

export type EIP1559TxParams = z.infer<typeof EIP1559TxParamsSchema>;

/**
 * EIP-1559トランザクションパラメータの検証
 * @param params 検証対象のパラメータ（任意の型）
 * @returns 検証済みのEIP-1559トランザクションパラメータ
 * @throws InvalidInputError 検証に失敗した場合
 */
export function validateEIP1559TxParams(params: unknown): EIP1559TxParams {
  const result = EIP1559TxParamsSchema.safeParse(params);
  if (!result.success) {
    const errorMessages = result.error.errors
      .map((e) => {
        const path = e.path.join('.');
        return `${path ? `${path}: ` : ''}${e.message}`;
      })
      .join('; ');
    throw new InvalidInputError(`無効なトランザクションパラメータです: ${errorMessages}`);
  }
  return result.data;
}
