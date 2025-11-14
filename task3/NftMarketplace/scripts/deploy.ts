import { Addressable } from 'ethers';
import { ethers, upgrades } from "hardhat";

interface ContractStartupData {
  deployer: string;
  network: string;
  blockNumber: number;
  myToken: string | Addressable;
  myNFT: string | Addressable;
  priceOracle: string | Addressable;
  nftAuctionFactory: string | Addressable;
}

async function main() {
  const contractStartupData: Partial<ContractStartupData> = {};

  const [deployer] = await ethers.getSigners();
  contractStartupData.deployer = deployer.address;
  console.log("部署者地址:", contractStartupData.deployer);
  // 获取默认的以太坊提供商
  const provider = ethers.provider;

  const network = await provider.getNetwork();
  console.log(network.toJSON());
  contractStartupData.network = network.name;

  // 打印当前网络的区块高度
  const blockNumber = await provider.getBlockNumber();
  console.log("当前网络的区块高度：", blockNumber);
  contractStartupData.blockNumber = blockNumber;

  {
    // deploy MyToken
    const contract = await ethers.deployContract("MyToken");
    await contract.waitForDeployment();
    // 显示部署信息 `区块  gas  合约地址   合约名称`
    const tx = contract.deploymentTransaction();
    if (tx) {
      const { gasLimit, } = tx;
      console.log(`${gasLimit}\t${contract.target}\tMyToken`);
    }
    contractStartupData.myToken = contract.target;
  }
  {
    // deploy MyNFT
    const contract = await ethers.deployContract("MyNFT");

    // 显示部署信息 `区块  gas  合约地址   合约名称`
    const tx = contract.deploymentTransaction();
    if (tx) {
      const { gasLimit, } = tx;
      console.log(`${gasLimit}\t${contract.target}\tMyNFT`);
    }
    contractStartupData.myNFT = contract.target;
  }
  {
    // deploy PriceOracle with ethPriceFeed as argument
    const ethPriceFeed = process.env.ETH_PRICE_FEED;
    const contract = await ethers.deployContract("ChainlinkPriceOracle", [ethPriceFeed]);
    await contract.waitForDeployment();
    // 显示部署信息 `区块  gas  合约地址   合约名称`
    const tx = contract.deploymentTransaction();
    if (tx) {
      const { gasLimit, } = tx;
      console.log(`${gasLimit}\t${contract.target}\tChainlinkPriceOracle`);
    }
    contractStartupData.priceOracle = contract.target;
  }
  {
    // deploy NFTAuctionFactory in UUPS Proxy mode
    const contract = await ethers.getContractFactory("NFTAuctionFactory");
    const proxy = await upgrades.deployProxy(contract, [deployer.address, deployer.address,]);
    await proxy.waitForDeployment();
    // 显示部署信息 `区块  gas  合约地址   合约名称`
    const tx = proxy.deploymentTransaction();
    if (tx) {
      const { gasLimit, } = tx;
      console.log(`${gasLimit}\t${proxy.target}\tNFTAuctionFactory`);
    }
    contractStartupData.nftAuctionFactory = proxy.target;
  }
  console.log(JSON.stringify(contractStartupData));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});