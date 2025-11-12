import { ethers } from "hardhat";

async function main() {
  console.log("开始部署NFT拍卖系统与Chainlink价格预言机集成...");

  // 获取部署者账户
  const [deployer] = await ethers.getSigners();
  console.log(`部署者地址: ${deployer.address}`);

  // 部署 MyNFT 合约
  console.log("部署 MyNFT 合约...");
  const MyNFT = await ethers.getContractFactory("MyNFT");
  const myNFT = await MyNFT.deploy();
  await myNFT.waitForDeployment();
  console.log(`MyNFT 合约地址: ${await myNFT.getAddress()}`);

  // 部署 MyToken 合约
  console.log("部署 MyToken 合约...");
  const MyToken = await ethers.getContractFactory("MyToken");
  const myToken = await MyToken.deploy();
  await myToken.waitForDeployment();
  console.log(`MyToken 合约地址: ${await myToken.getAddress()}`);

  // 部署 ChainlinkPriceOracle 合约
  console.log("部署 ChainlinkPriceOracle 合约...");
  const ChainlinkPriceOracle = await ethers.getContractFactory("ChainlinkPriceOracle");
  
  // Sepolia测试网的ETH/USD价格源地址
  const sepoliaETHPriceFeed = "0x694AA1769357215DE4FAC081bf1f309aDC325306";
  const chainlinkPriceOracle = await ChainlinkPriceOracle.deploy(sepoliaETHPriceFeed);
  await chainlinkPriceOracle.waitForDeployment();
  console.log(`ChainlinkPriceOracle 合约地址: ${await chainlinkPriceOracle.getAddress()}`);

  // 部署 NFTAuction 合约
  console.log("部署 NFTAuction 合约...");
  const NFTAuction = await ethers.getContractFactory("NFTAuction");
  const nftAuction = await NFTAuction.deploy();
  await nftAuction.waitForDeployment();
  console.log(`NFTAuction 合约地址: ${await nftAuction.getAddress()}`);

  // 设置价格预言机
  console.log("设置价格预言机...");
  await nftAuction.setPriceOracle(await chainlinkPriceOracle.getAddress());
  console.log("价格预言机设置完成");

  // 配置代币价格源（示例：配置DAI/USD价格源）
  console.log("配置代币价格源...");
  const sepoliaDAIPriceFeed = "0x14866185B1962B63C3Ea9E03Bc1da838bab34C19";
  await chainlinkPriceOracle.setTokenPriceFeed(await myToken.getAddress(), sepoliaDAIPriceFeed);
  console.log(`MyToken 价格源设置完成: ${sepoliaDAIPriceFeed}`);

  // 铸造测试NFT
  console.log("铸造测试NFT...");
  const tokenURI = "https://example.com/token/1";
  await myNFT.safeMint(deployer.address, tokenURI);
  console.log(`NFT 铸造完成，Token ID: 0`);

  // 铸造测试代币
  console.log("铸造测试代币...");
  await myToken.mint(deployer.address, 1000);
  console.log("1000个测试代币铸造完成");

  console.log("\n=== 部署摘要 ===");
  console.log(`MyNFT 合约: ${await myNFT.getAddress()}`);
  console.log(`MyToken 合约: ${await myToken.getAddress()}`);
  console.log(`ChainlinkPriceOracle 合约: ${await chainlinkPriceOracle.getAddress()}`);
  console.log(`NFTAuction 合约: ${await nftAuction.getAddress()}`);
  console.log(`ETH/USD 价格源: ${sepoliaETHPriceFeed}`);
  console.log(`DAI/USD 价格源: ${sepoliaDAIPriceFeed}`);
  console.log("=== 部署完成 ===");

  // 验证价格预言机集成
  console.log("\n=== 验证价格预言机集成 ===");
  
  // 验证ETH价格
  try {
    const [ethPrice, ethTimestamp] = await chainlinkPriceOracle.getETHPrice();
    console.log(`ETH/USD 价格: $${Number(ethPrice) / 1e8} (时间戳: ${ethTimestamp})`);
  } catch (error) {
    console.log("ETH价格查询失败，可能价格源不可用");
  }

  // 验证代币价格
  try {
    const [tokenPrice, tokenTimestamp] = await chainlinkPriceOracle.getTokenPrice(await myToken.getAddress());
    console.log(`MyToken/USD 价格: $${Number(tokenPrice) / 1e8} (时间戳: ${tokenTimestamp})`);
  } catch (error) {
    console.log("代币价格查询失败，可能价格源不可用");
  }

  console.log("\n=== 使用说明 ===");
  console.log("1. 创建ETH拍卖:");
  console.log(`   await nftAuction.createAuction(
    "${await myNFT.getAddress()}", 
    0, 
    ethers.parseEther("1"), 
    ethers.parseEther("2"), 
    3600, 
    0, 
    ethers.ZeroAddress
  )`);

  console.log("\n2. 创建ERC20拍卖:");
  console.log(`   await nftAuction.createAuction(
    "${await myNFT.getAddress()}", 
    0, 
    100, 
    200, 
    3600, 
    1, 
    "${await myToken.getAddress()}"
  )`);

  console.log("\n3. 出价时系统会自动计算并记录美元价值");
  console.log("4. 查看BidPlaced事件中的amountInUSD字段获取美元价值");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
