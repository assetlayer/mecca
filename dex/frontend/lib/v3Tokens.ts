// V3 Pool token definitions
export const V3_TOKENS = [
  {
    chainId: 621030,
    address: "0x0000000000000000000000000000000000000000", // Native token address
    name: "AssetLayer",
    symbol: "ASL",
    decimals: 18,
    isNative: true,
    logoURI: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86a33E6441c8C06DDd5d8c8C4e4f1c4B4B4B4/logo.png"
  },
  {
    chainId: 621030,
    address: "0x2e83297970aBdc26691432bB72Cb8e19c8818b11",
    name: "Asset USD",
    symbol: "AUSD",
    decimals: 6,
    isNative: false,
    logoURI: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86a33E6441c8C06DDd5d8c8C4e4f1c4B4B4B4/logo.png"
  },
  {
    chainId: 621030,
    address: "0x5bF0980739B073811b94Ad9e21Bce8C04dcc778b",
    name: "Wrapped ASL",
    symbol: "WASL",
    decimals: 18,
    isNative: false,
    logoURI: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86a33E6441c8C06DDd5d8c8C4e4f1c4B4B4B4/logo.png"
  }
];

export type V3TokenInfo = typeof V3_TOKENS[0];

export function findV3Token(address: string | undefined) {
  if (!address) return undefined;
  return V3_TOKENS.find((token) => token.address.toLowerCase() === address.toLowerCase());
}
