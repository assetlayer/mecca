import { ethers } from "hardhat";

async function main() {
  const [signer] = await ethers.getSigners();
  const me = await signer.getAddress();
  console.log("Using address:", me);

  // Get network info
  const network = await ethers.provider.getNetwork();
  console.log("Network:", network);

  // Get block info
  const blockNumber = await ethers.provider.getBlockNumber();
  console.log("Current block number:", blockNumber);

  // Get balance
  const balance = await ethers.provider.getBalance(me);
  console.log("ETH balance:", ethers.formatEther(balance));

  // Get PoolManager address
  const poolManagerAddress = process.env.POOL_MANAGER_ADDRESS;
  if (!poolManagerAddress) {
    throw new Error("Set POOL_MANAGER_ADDRESS in contracts/.env");
  }
  console.log("PoolManager address:", poolManagerAddress);

  // Check if PoolManager contract exists
  const code = await ethers.provider.getCode(poolManagerAddress);
  if (code === "0x") {
    console.log("✗ PoolManager contract not found at address");
    return;
  }
  console.log("✓ PoolManager contract found");

  // Try to create PoolManager contract
  try {
    const pm = await ethers.getContractAt("PoolManager", poolManagerAddress);
    console.log("✓ PoolManager contract created successfully");
    
    // Try to call a simple view function
    try {
      const owner = await pm.owner();
      console.log("✓ PoolManager owner:", owner);
    } catch (e: any) {
      console.error("✗ Failed to call owner():", e?.error?.message || e?.message || e);
    }
  } catch (e: any) {
    console.error("✗ Failed to create PoolManager contract:", e?.error?.message || e?.message || e);
  }

  // Check token addresses
  const tokenA = process.env.SEED_TOKEN_A;
  const tokenB = process.env.SEED_TOKEN_B;
  console.log("TokenA:", tokenA);
  console.log("TokenB:", tokenB);

  if (tokenA) {
    const codeA = await ethers.provider.getCode(tokenA);
    if (codeA === "0x") {
      console.log("✗ TokenA contract not found");
    } else {
      console.log("✓ TokenA contract found");
    }
  }

  if (tokenB) {
    const codeB = await ethers.provider.getCode(tokenB);
    if (codeB === "0x") {
      console.log("✗ TokenB contract not found");
    } else {
      console.log("✓ TokenB contract found");
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
