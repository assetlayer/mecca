import { ethers } from "hardhat";

async function main() {
  const tokenA = process.env.SEED_TOKEN_A!;
  const tokenB = process.env.SEED_TOKEN_B!;
  
  const basicERC20Abi = [
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)",
  ];
  
  const [signer] = await ethers.getSigners();
  const tA = new ethers.Contract(tokenA, basicERC20Abi, signer);
  const tB = new ethers.Contract(tokenB, basicERC20Abi, signer);
  
  const decA = Number(await tA.decimals());
  const decB = Number(await tB.decimals());
  const symbolA = await tA.symbol();
  const symbolB = await tB.symbol();
  
  console.log('Token A:', symbolA, 'decimals:', decA);
  console.log('Token B:', symbolB, 'decimals:', decB);
  console.log('Difference (B - A):', decB - decA);
  
  // Calculate correct sqrtPriceX96 for 1:1
  const Q96 = BigInt(2) ** BigInt(96);
  const diff = decB - decA;
  
  function bigintSqrt(value: bigint): bigint {
    if (value <= 0n) return 0n;
    let x = value;
    let y = (x + 1n) >> 1n;
    while (y < x) {
      x = y;
      y = (x + value / x) >> 1n;
    }
    return x;
  }
  
  let sqrtPriceX96: bigint;
  
  if (diff === 0) {
    sqrtPriceX96 = Q96;
    console.log('sqrtPriceX96 for 1:1 (same decimals):', sqrtPriceX96.toString());
  } else if (diff > 0) {
    // currency1 has more decimals, so 1 unit of currency0 = 10^diff units of currency1
    const ratio = BigInt(10) ** BigInt(diff);
    sqrtPriceX96 = Q96 * bigintSqrt(ratio);
    console.log('Ratio (10^diff):', ratio.toString());
    console.log('sqrtPriceX96 for 1:1:', sqrtPriceX96.toString());
  } else {
    // currency0 has more decimals, so 1 unit of currency0 = 10^(-diff) units of currency1
    const inv = BigInt(10) ** BigInt(-diff);
    sqrtPriceX96 = Q96 * bigintSqrt(BigInt(1) / inv);
    console.log('Inverse ratio (10^(-diff)):', inv.toString());
    console.log('sqrtPriceX96 for 1:1:', sqrtPriceX96.toString());
  }
  
  // Also show the simple approach used in other scripts
  const simpleSqrtPrice = ethers.parseUnits("1", 0) * (2n ** 96n);
  console.log('Simple sqrtPriceX96 (2^96):', simpleSqrtPrice.toString());
  
  console.log('\nComparison:');
  console.log('Current seedPool.ts uses:', '79228162514264337593543950336000000');
  console.log('Calculated value:', sqrtPriceX96.toString());
  console.log('Simple value (2^96):', simpleSqrtPrice.toString());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
