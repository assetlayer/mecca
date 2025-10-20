import { ethers } from "hardhat";

async function main() {
  const [signer] = await ethers.getSigners();
  const me = await signer.getAddress();
  console.log("Using address:", me);

  // Get addresses
  const poolManagerAddress = process.env.POOL_MANAGER_ADDRESS;
  const tokenA = process.env.SEED_TOKEN_A!;
  const tokenB = process.env.SEED_TOKEN_B!;
  
  if (!poolManagerAddress || !tokenA || !tokenB) {
    throw new Error("Set POOL_MANAGER_ADDRESS, SEED_TOKEN_A, and SEED_TOKEN_B in contracts/.env");
  }

  // Create contracts
  const pm = await ethers.getContractAt("PoolManager", poolManagerAddress);
  const tA = await ethers.getContractAt("IERC20Minimal", tokenA);
  const tB = await ethers.getContractAt("IERC20Minimal", tokenB);

  // Use the working pool configuration
  const key = {
    currency0: tokenA < tokenB ? tokenA : tokenB,
    currency1: tokenA < tokenB ? tokenB : tokenA,
    fee: 500,
    tickSpacing: 10,
    hooks: ethers.ZeroAddress,
  };

  console.log("PoolKey:", key);

  // Check if pool exists
  const poolId = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
    ["address", "address", "uint24", "int24", "address"],
    [key.currency0, key.currency1, key.fee, key.tickSpacing, key.hooks]
  ));
  
  console.log("PoolId:", poolId);

  try {
    await pm.extsload(poolId);
    console.log("✓ Pool exists and is initialized");
  } catch (e: any) {
    console.log("✗ Pool does not exist or is not initialized");
    return;
  }

  // Try to add liquidity
  console.log("Attempting to add liquidity...");
  
  const MIN_TICK = -60;
  const MAX_TICK = 60;
  const liquidityAmount = ethers.toBigInt("1000000000000000000"); // 1e18
  
  const mlParams = {
    tickLower: MIN_TICK,
    tickUpper: MAX_TICK,
    liquidityDelta: liquidityAmount,
    salt: ethers.ZeroHash,
  };
  
  console.log("Liquidity params:", {
    tickLower: MIN_TICK,
    tickUpper: MAX_TICK,
    liquidityDelta: liquidityAmount.toString(),
  });
  
  try {
    await (await pm.modifyLiquidity(key, mlParams, "0x")).wait();
    console.log("✓ Liquidity added successfully!");
  } catch (e: any) {
    console.error("✗ modifyLiquidity failed:", e?.error?.message || e?.message || e);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
