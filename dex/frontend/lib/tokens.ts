import { z } from "zod";

const tokenSchema = z.object({
  chainId: z.number().optional(),
  address: z.string(),
  name: z.string(),
  symbol: z.string(),
  decimals: z.number(),
  logoURI: z.string().optional()
});

const tokenListSchema = z.object({
  tokens: z.array(tokenSchema)
});

export type TokenInfo = z.infer<typeof tokenSchema>;

export async function fetchTokenList(): Promise<TokenInfo[]> {
  const url = process.env.NEXT_PUBLIC_TOKEN_LIST_URL;
  if (!url) throw new Error("NEXT_PUBLIC_TOKEN_LIST_URL missing");
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to load token list");
  const json = await res.json();
  const parsed = tokenListSchema.parse(json);
  return parsed.tokens.filter((token) => !token.chainId || token.chainId === Number(process.env.NEXT_PUBLIC_CHAIN_ID || 621030));
}

export function findToken(tokens: TokenInfo[], address: string | undefined) {
  if (!address) return undefined;
  return tokens.find((token) => token.address.toLowerCase() === address.toLowerCase());
}

export const DEFAULT_INPUT_TOKEN = process.env.NEXT_PUBLIC_DEFAULT_INPUT_TOKEN;
export const DEFAULT_OUTPUT_TOKEN = process.env.NEXT_PUBLIC_DEFAULT_OUTPUT_TOKEN;
