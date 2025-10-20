import { ethers } from "hardhat";

async function main() {
  const [signer] = await ethers.getSigners();
  const me = await signer.getAddress();
  console.log("Using address:", me);

  // Get addresses
  const poolManagerAddress = process.env.POOL_MANAGER_ADDRESS;
  
  if (!poolManagerAddress) {
    throw new Error("Set POOL_MANAGER_ADDRESS in contracts/.env");
  }

  // Create contracts
  const pm = await ethers.getContractAt("PoolManager", poolManagerAddress);

  console.log("=== Trying to Set Operator Status ===");
  
  // Check current operator status
  try {
    const owner = await pm.owner();
    console.log("PoolManager owner:", owner);
    console.log("Our address:", me);
    
    const isOperator = await pm.isOperator(owner, me);
    console.log("Current operator status:", isOperator);
  } catch (e: any) {
    console.error("Failed to check operator status:", e?.error?.message || e?.message || e);
  }

  // Try to set ourselves as an operator
  console.log("\n=== Attempting to Set Operator Status ===");
  
  try {
    // Try to set ourselves as an operator of the owner
    const owner = await pm.owner();
    console.log("Trying to set operator status...");
    
    // First try static call to see if it would work
    try {
      await pm.setOperator.staticCall(me, true);
      console.log("✓ Static call succeeded, proceeding with transaction...");
      
      const tx = await pm.setOperator(me, true);
      await tx.wait();
      console.log("✓ Successfully set operator status!");
      
      // Check if it worked
      const isOperator = await pm.isOperator(owner, me);
      console.log("New operator status:", isOperator);
      
    } catch (e: any) {
      console.error("✗ Failed to set operator status:", e?.error?.message || e?.message || e);
    }
    
  } catch (e: any) {
    console.error("✗ Error in operator setup:", e?.error?.message || e?.message || e);
  }

  // If we can't set operator status, try alternative approaches
  console.log("\n=== Alternative Approaches ===");
  
  // Check if there are any other ways to initialize pools
  console.log("Checking if there are alternative initialization methods...");
  
  const altFunctions = [
    'initializePool',
    'createPool',
    'addPool',
    'registerPool'
  ];

  for (const func of altFunctions) {
    try {
      if (typeof pm[func] === 'function') {
        console.log(`✓ Function ${func} exists`);
      } else {
        console.log(`✗ Function ${func} does not exist`);
      }
    } catch (e: any) {
      console.log(`✗ Error checking ${func}:`, e?.error?.message || e?.message || e);
    }
  }

  // Check if we can use a different approach
  console.log("\n=== Checking for Alternative Pool Creation Methods ===");
  
  // Try to see if there are any factory contracts or other ways to create pools
  try {
    const factory = await pm.factory();
    console.log("Factory address:", factory);
  } catch (e: any) {
    console.log("No factory() function or error:", e?.error?.message || e?.message || e);
  }

  // Check if there are any other pool-related functions
  const poolFunctions = [
    'createPool',
    'addPool',
    'registerPool',
    'initializePool',
    'newPool'
  ];

  for (const func of poolFunctions) {
    try {
      if (typeof pm[func] === 'function') {
        console.log(`✓ Function ${func} exists`);
      } else {
        console.log(`✗ Function ${func} does not exist`);
      }
    } catch (e: any) {
      console.log(`✗ Error checking ${func}:`, e?.error?.message || e?.message || e);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
