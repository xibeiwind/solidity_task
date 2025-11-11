import { ethers } from "hardhat";

async function main() { 
      // 获取默认的以太坊提供商
    const provider = ethers.provider;
    const network = await provider.getNetwork();
    console.log( network.toJSON())
    
    // 打印当前网络的区块高度
    const blockNumber = await provider.getBlockNumber();
    console.log("当前网络的区块高度：", blockNumber);

    const contracts=["MyToken", "MyNFT", "NFTAuction"];
    
    for (const contractName of contracts) { 
      const contract = await ethers.deployContract(contractName);
      await contract.waitForDeployment();
      console.log(`${contract} deployed to ${contract.target}`);
    }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});