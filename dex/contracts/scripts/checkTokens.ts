import { ethers } from "hardhat";

async function main() {
  const [signer] = await ethers.getSigners();
  const me = await signer.getAddress();
  console.log("Using address:", me);

  // Get addresses
  const tokenA = process.env.SEED_TOKEN_A!;
  const tokenB = process.env.SEED_TOKEN_B!;
  
  if (!tokenA || !tokenB) {
    throw new Error("Set SEED_TOKEN_A and SEED_TOKEN_B in contracts/.env");
  }

  console.log("TokenA:", tokenA);
  console.log("TokenB:", tokenB);

  // Check if tokens are valid contracts
  console.log("\n=== Token Contract Validation ===");
  
  try {
    const codeA = await ethers.provider.getCode(tokenA);
    const codeB = await ethers.provider.getCode(tokenB);
    console.log("TokenA code length:", codeA.length);
    console.log("TokenB code length:", codeB.length);
    console.log("TokenA deployed:", codeA !== "0x");
    console.log("TokenB deployed:", codeB !== "0x");
  } catch (e: any) {
    console.log("Failed to get token codes:", e?.error?.message || e?.message || e);
  }

  // Try to interact with tokens using different ABIs
  console.log("\n=== Token Interface Tests ===");
  
  // Test with basic ERC20 ABI
  const basicERC20Abi = [
    "function decimals() view returns (uint8)",
    "function balanceOf(address) view returns (uint256)",
    "function totalSupply() view returns (uint256)",
    "function name() view returns (string)",
    "function symbol() view returns (string)",
  ];

  try {
    const tA = new ethers.Contract(tokenA, basicERC20Abi, signer);
    const tB = new ethers.Contract(tokenB, basicERC20Abi, signer);
    
    console.log("Testing TokenA...");
    try {
      const decA = await tA.decimals();
      console.log("TokenA decimals:", decA);
    } catch (e: any) {
      console.log("TokenA decimals failed:", e?.error?.message || e?.message || e);
    }
    
    try {
      const balA = await tA.balanceOf(me);
      console.log("TokenA balance:", balA.toString());
    } catch (e: any) {
      console.log("TokenA balance failed:", e?.error?.message || e?.message || e);
    }
    
    try {
      const nameA = await tA.name();
      console.log("TokenA name:", nameA);
    } catch (e: any) {
      console.log("TokenA name failed:", e?.error?.message || e?.message || e);
    }
    
    try {
      const symbolA = await tA.symbol();
      console.log("TokenA symbol:", symbolA);
    } catch (e: any) {
      console.log("TokenA symbol failed:", e?.error?.message || e?.message || e);
    }
    
    console.log("Testing TokenB...");
    try {
      const decB = await tB.decimals();
      console.log("TokenB decimals:", decB);
    } catch (e: any) {
      console.log("TokenB decimals failed:", e?.error?.message || e?.message || e);
    }
    
    try {
      const balB = await tB.balanceOf(me);
      console.log("TokenB balance:", balB.toString());
    } catch (e: any) {
      console.log("TokenB balance failed:", e?.error?.message || e?.message || e);
    }
    
    try {
      const nameB = await tB.name();
      console.log("TokenB name:", nameB);
    } catch (e: any) {
      console.log("TokenB name failed:", e?.error?.message || e?.message || e);
    }
    
    try {
      const symbolB = await tB.symbol();
      console.log("TokenB symbol:", symbolB);
    } catch (e: any) {
      console.log("TokenB symbol failed:", e?.error?.message || e?.message || e);
    }
    
  } catch (e: any) {
    console.log("Failed to test tokens:", e?.error?.message || e?.message || e);
  }

  // Test with IERC20Minimal ABI
  console.log("\n=== IERC20Minimal Interface Tests ===");
  
  const minimalERC20Abi = [
    "function decimals() view returns (uint8)",
    "function balanceOf(address) view returns (uint256)",
    "function totalSupply() view returns (uint256)",
  ];

  try {
    const tA = new ethers.Contract(tokenA, minimalERC20Abi, signer);
    const tB = new ethers.Contract(tokenB, minimalERC20Abi, signer);
    
    console.log("Testing TokenA with IERC20Minimal...");
    try {
      const decA = await tA.decimals();
      console.log("TokenA decimals (minimal):", decA);
    } catch (e: any) {
      console.log("TokenA decimals (minimal) failed:", e?.error?.message || e?.message || e);
    }
    
    console.log("Testing TokenB with IERC20Minimal...");
    try {
      const decB = await tB.decimals();
      console.log("TokenB decimals (minimal):", decB);
    } catch (e: any) {
      console.log("TokenB decimals (minimal) failed:", e?.error?.message || e?.message || e);
    }
    
  } catch (e: any) {
    console.log("Failed to test tokens with IERC20Minimal:", e?.error?.message || e?.message || e);
  }

  // Check if tokens are the same
  console.log("\n=== Token Comparison ===");
  console.log("Are tokens the same?", tokenA.toLowerCase() === tokenB.toLowerCase());
  
  // Check if tokens are zero address
  console.log("Is TokenA zero address?", tokenA === ethers.ZeroAddress);
  console.log("Is TokenB zero address?", tokenB === ethers.ZeroAddress);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});