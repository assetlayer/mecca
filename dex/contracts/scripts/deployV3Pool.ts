import { ethers } from "hardhat";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

// Read addresses from the JSON file
function readAddresses() {
  const addressesPath = join(__dirname, "../../frontend/lib/addresses.json");
  return JSON.parse(readFileSync(addressesPath, "utf8"));
}

// Write addresses to the JSON file
function writeAddresses(addresses: any) {
  const addressesPath = join(__dirname, "../../frontend/lib/addresses.json");
  writeFileSync(addressesPath, JSON.stringify(addresses, null, 2));
}

async function main() {
  console.log("=== Deploying Simple V3 Pool ===");
  
  const tokenA = process.env.SEED_TOKEN_A!; // e.g. WASL
  const tokenB = process.env.SEED_TOKEN_B!; // e.g. AUSD
  if (!tokenA || !tokenB) throw new Error("Set SEED_TOKEN_A and SEED_TOKEN_B in contracts/.env");

  console.log("Token A:", tokenA);
  console.log("Token B:", tokenB);

  const [signer] = await ethers.getSigners();
  console.log("Using account:", await signer.getAddress());

  // Sort tokens deterministically (lower address first)
  const [token0, token1] = tokenA.toLowerCase() < tokenB.toLowerCase() ? [tokenA, tokenB] : [tokenB, tokenA];
  console.log("Token0 (lower address):", token0);
  console.log("Token1 (higher address):", token1);

  // Deploy SimpleV3Pool
  console.log("Deploying SimpleV3Pool...");
  const SimpleV3Pool = await ethers.getContractFactory("SimpleV3Pool");
  const pool = await SimpleV3Pool.deploy(token0, token1);
  await pool.waitForDeployment();
  
  const poolAddress = await pool.getAddress();
  console.log("✓ SimpleV3Pool deployed to:", poolAddress);

  // Read existing addresses and update
  const addresses = readAddresses();
  addresses.SIMPLE_V3_POOL = poolAddress;
  writeAddresses(addresses);

  console.log("✓ Addresses updated in frontend/lib/addresses.json");
  console.log("Pool is ready for liquidity provision!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
