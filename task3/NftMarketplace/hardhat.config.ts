import type { HardhatUserConfig } from "hardhat/types/config";
import "@nomicfoundation/hardhat-toolbox";
import "dotenv/config";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.28",
    settings: {
      viaIR: true,
      optimizer: {
        enabled: true,
        runs: 2000
      }
    }
  },
  networks: {
    sepolia: {
      url: process.env.SEPOLIA_URL,
      accounts: [process.env.ACCOUNT_PRIVATE_KEY!],
    },
  },

};

export default config;
