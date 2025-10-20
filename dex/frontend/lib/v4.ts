import addressesFile from "./addresses.json" assert { type: "json" };

export const minimalSwapRouterAbi = [
  {
    name: "swapExactInput",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "key", type: "tuple", components: [
              { name: "currency0", type: "address" },
              { name: "currency1", type: "address" },
              { name: "fee", type: "uint24" },
              { name: "tickSpacing", type: "int24" },
              { name: "hook", type: "address" }
            ] },
          { name: "amountIn", type: "uint256" },
          { name: "amountOutMin", type: "uint256" },
          { name: "recipient", type: "address" },
          { name: "payer", type: "address" },
          { name: "zeroForOne", type: "bool" },
          { name: "sqrtPriceLimitX96", type: "uint160" },
          { name: "deadline", type: "uint256" }
        ]
      }
    ],
    outputs: [{ name: "amountOut", type: "uint256" }]
  },
  {
    name: "swapExactOutput",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "key", type: "tuple", components: [
              { name: "currency0", type: "address" },
              { name: "currency1", type: "address" },
              { name: "fee", type: "uint24" },
              { name: "tickSpacing", type: "int24" },
              { name: "hook", type: "address" }
            ] },
          { name: "amountOut", type: "uint256" },
          { name: "amountInMax", type: "uint256" },
          { name: "recipient", type: "address" },
          { name: "payer", type: "address" },
          { name: "zeroForOne", type: "bool" },
          { name: "sqrtPriceLimitX96", type: "uint160" },
          { name: "deadline", type: "uint256" }
        ]
      }
    ],
    outputs: [{ name: "amountIn", type: "uint256" }]
  },
  {
    name: "SwapExecuted",
    type: "event",
    inputs: [
      { name: "sender", type: "address", indexed: true },
      { name: "recipient", type: "address", indexed: true },
      { name: "zeroForOne", type: "bool", indexed: false },
      { name: "amountIn", type: "uint256", indexed: false },
      { name: "amountOut", type: "uint256", indexed: false }
    ]
  }
] as const;

// Uniswap v3/v4 use the same sqrt price bounds.
const MIN_SQRT_RATIO = 4295128739n;
const MAX_SQRT_RATIO = 1461446703485210103287273052203988822378723970342n;
export const MIN_SQRT_PRICE_LIMIT = MIN_SQRT_RATIO + 1n;
export const MAX_SQRT_PRICE_LIMIT = MAX_SQRT_RATIO - 1n;

export const erc20Abi = [
  { name: "approve", type: "function", stateMutability: "nonpayable", inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" }
    ], outputs: [{ name: "", type: "bool" }] },
  { name: "allowance", type: "function", stateMutability: "view", inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" }
    ], outputs: [{ name: "", type: "uint256" }] },
  { name: "balanceOf", type: "function", stateMutability: "view", inputs: [
      { name: "owner", type: "address" }
    ], outputs: [{ name: "", type: "uint256" }] },
  { name: "decimals", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint8" }] },
  { name: "symbol", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "string" }] }
] as const;

export const assetLayerSwapHookAbi = [
  { name: "feeRecipient", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "address" }] },
  { name: "feeE6", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] }
] as const;

export const addresses = addressesFile as {
  ASSET_LAYER_SWAP_HOOK: `0x${string}` | "";
  MINIMAL_SWAP_ROUTER: `0x${string}` | "";
};

export const POOL_MANAGER_ADDRESS = process.env.NEXT_PUBLIC_POOL_MANAGER_ADDRESS as `0x${string}` | undefined;
