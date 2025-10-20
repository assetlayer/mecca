import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-ethers";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, ".env") });

declare module "hardhat/types/config" {
  interface NetworksUserConfig {
    assetlayer?: {
      url: string;
      accounts?: string[];
      chainId: number;
    };
  }
}

const PRIVATE_KEY = process.env.PRIVATE_KEY;
const RPC_URL = process.env.NEXT_PUBLIC_ASSETLAYER_RPC_URL ||
  "https://rpc-test.assetlayer.org/GR5Yv0OFarUAgowmDA4V/ext/bc/m1cxPWPsTFfZdsp2sizU4Vny1oCgqsVdKPdrFcb6VLsW1kGfz/rpc";

const OPTIMIZER_SETTINGS = {
  optimizer: {
    enabled: true,
    runs: 200
  }
};

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.8.24",
        settings: { ...OPTIMIZER_SETTINGS, evmVersion: "cancun" }
      },
      {
        version: "0.8.26",
        settings: { ...OPTIMIZER_SETTINGS, evmVersion: "cancun" }
      }
    ]
  },
  defaultNetwork: "hardhat",
  networks: {
    hardhat: { hardfork: "cancun" },
    assetlayer: {
      url: RPC_URL,
      chainId: Number(process.env.NEXT_PUBLIC_CHAIN_ID || 621030),
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : []
    }
  }
};

export default config;
