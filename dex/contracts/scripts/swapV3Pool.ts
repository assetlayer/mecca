import { ethers } from "hardhat";
import { readFileSync } from "fs";
import { join } from "path";

// Read addresses from the JSON file
function readAddresses() {
  const addressesPath = join(__dirname, "../../frontend/lib/addresses.json");
  return JSON.parse(readFileSync(addressesPath, "utf8"));
}

// Sort tokens deterministically (lower address first)
function sortTokens(tokenA: string, tokenB: string): [string, string] {
  return tokenA.toLowerCase() < tokenB.toLowerCase() ? [tokenA, tokenB] : [tokenB, tokenA];
}

async function main() {
  const addrs = readAddresses();
  const poolAddress = addrs.SIMPLE_V3_POOL;

  if (!poolAddress) {
    throw new Error("SIMPLE_V3_POOL is required in addresses.json - deploy the pool first");
  }

  const tokenA = process.env.SEED_TOKEN_A!; // e.g. WASL
  const tokenB = process.env.SEED_TOKEN_B!; // e.g. AUSD
  if (!tokenA || !tokenB) throw new Error("Set SEED_TOKEN_A and SEED_TOKEN_B in contracts/.env");

  console.log("=== Testing Simple V3 Pool Swap ===");
  console.log("Pool:", poolAddress);
  console.log("Token A:", tokenA);
  console.log("Token B:", tokenB);

  const [signer] = await ethers.getSigners();
  console.log("Using account:", await signer.getAddress());

  // Sort tokens deterministically
  const [currency0, currency1] = sortTokens(tokenA, tokenB);
  console.log("Sorted tokens - currency0:", currency0, "currency1:", currency1);

  // Get token contracts
  const token0 = await ethers.getContractAt("ERC20", currency0);
  const token1 = await ethers.getContractAt("ERC20", currency1);

  // Get token decimals
  const decimals0 = Number(await token0.decimals());
  const decimals1 = Number(await token1.decimals());
  console.log("Token0 decimals:", decimals0, "Token1 decimals:", decimals1);

  // Get pool contract
  const pool = await ethers.getContractAt("SimpleV3Pool", poolAddress);

  // Check current reserves
  const [reserve0, reserve1] = await pool.getReserves();
  console.log("Current reserves - Token0:", ethers.formatUnits(reserve0, decimals0), "Token1:", ethers.formatUnits(reserve1, decimals1));

  // Check balances
  const balance0 = await token0.balanceOf(await signer.getAddress());
  const balance1 = await token1.balanceOf(await signer.getAddress());
  console.log("Your balances - Token0:", ethers.formatUnits(balance0, decimals0), "Token1:", ethers.formatUnits(balance1, decimals1));

  // Perform a small swap (1 token0 for token1)
  const swapAmount = ethers.parseUnits("1", decimals0);
  console.log("Swapping", ethers.formatUnits(swapAmount, decimals0), "Token0 for Token1...");

  // Approve pool to spend token0
  const approveTx = await token0.approve(poolAddress, swapAmount);
  await approveTx.wait();
  console.log("✓ Token0 approved for swap");

  // Perform swap
  const swapTx = await pool.swap(0, ethers.parseUnits("1", decimals1), await signer.getAddress());
  await swapTx.wait();
  console.log("✓ Swap completed!");

  // Check final balances
  const finalBalance0 = await token0.balanceOf(await signer.getAddress());
  const finalBalance1 = await token1.balanceOf(await signer.getAddress());
  console.log("Final balances - Token0:", ethers.formatUnits(finalBalance0, decimals0), "Token1:", ethers.formatUnits(finalBalance1, decimals1));

  // Check final reserves
  const [finalReserve0, finalReserve1] = await pool.getReserves();
  console.log("Final reserves - Token0:", ethers.formatUnits(finalReserve0, decimals0), "Token1:", ethers.formatUnits(finalReserve1, decimals1));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
