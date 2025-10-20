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

  console.log("=== Seeding Simple V3 Pool ===");
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

  // Check balances
  const balance0 = await token0.balanceOf(await signer.getAddress());
  const balance1 = await token1.balanceOf(await signer.getAddress());
  console.log("Token0 balance:", ethers.formatUnits(balance0, decimals0));
  console.log("Token1 balance:", ethers.formatUnits(balance1, decimals1));

  // Set amounts (100 tokens each for better liquidity)
  const amount0 = ethers.parseUnits("100", decimals0);
  const amount1 = ethers.parseUnits("100", decimals1);

  console.log("Amount0:", ethers.formatUnits(amount0, decimals0));
  console.log("Amount1:", ethers.formatUnits(amount1, decimals1));

  // Check if we have enough balance
  if (balance0 < amount0 || balance1 < amount1) {
    throw new Error("Insufficient token balance");
  }

  // Approve pool to spend tokens
  console.log("Approving tokens...");
  const approve0Tx = await token0.approve(poolAddress, amount0);
  await approve0Tx.wait();
  console.log("✓ Token0 approved");

  const approve1Tx = await token1.approve(poolAddress, amount1);
  await approve1Tx.wait();
  console.log("✓ Token1 approved");

  // Add liquidity
  console.log("Adding liquidity...");
  const mintTx = await pool.mint(amount0, amount1);
  await mintTx.wait();
  console.log("✓ Liquidity added successfully!");

  // Check final state
  const [reserve0, reserve1] = await pool.getReserves();
  console.log("Final reserves - Token0:", ethers.formatUnits(reserve0, decimals0), "Token1:", ethers.formatUnits(reserve1, decimals1));
  
  const userBalance = await pool.balanceOf(await signer.getAddress());
  console.log("Your LP token balance:", ethers.formatUnits(userBalance, 18));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
