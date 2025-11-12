import { ethers } from "hardhat";

async function main() {
  console.log("开始部署 NFTAuctionFactory...");

  // 获取部署者账户
  const [deployer] = await ethers.getSigners();
  console.log("部署者地址:", deployer.address);

  // 部署 MyNFT 合约
  console.log("部署 MyNFT 合约...");
  const MyNFT = await ethers.getContractFactory("MyNFT");
  const myNFT = await MyNFT.deploy();
  await myNFT.waitForDeployment();
  console.log("MyNFT 合约地址:", await myNFT.getAddress());

  // 部署 MyToken 合约
  console.log("部署 MyToken 合约...");
  const MyToken = await ethers.getContractFactory("MyToken");
  const myToken = await MyToken.deploy();
  await myToken.waitForDeployment();
  console.log("MyToken 合约地址:", await myToken.getAddress());

  // 部署 NFTAuctionFactory 合约
  console.log("部署 NFTAuctionFactory 合约...");
  const NFTAuctionFactory = await ethers.getContractFactory("NFTAuctionFactory");
  const nftAuctionFactory = await NFTAuctionFactory.deploy(deployer.address);
  await nftAuctionFactory.waitForDeployment();
  console.log("NFTAuctionFactory 合约地址:", await nftAuctionFactory.getAddress());

  // 铸造 NFT 用于演示
  console.log("铸造 NFT 用于演示...");
  const tokenURI = "https://example.com/token/1";
  await myNFT.safeMint(deployer.address, tokenURI);
  console.log("NFT 铸造完成，Token ID: 0");

  // 演示创建拍卖
  console.log("\n--- 演示创建拍卖 ---");
  const startingPrice = ethers.parseEther("1");
  const reservePrice = ethers.parseEther("2");
  const duration = 3600; // 1小时

  console.log("创建拍卖参数:");
  console.log("- NFT 地址:", await myNFT.getAddress());
  console.log("- 卖家地址:", deployer.address);
  console.log("- Token ID: 0");
  console.log("- 起拍价格:", startingPrice.toString(), "wei");
  console.log("- 保留价格:", reservePrice.toString(), "wei");
  console.log("- 持续时间:", duration, "秒");

  // 授权 NFT 给工厂合约（实际使用中需要先授权）
  console.log("授权 NFT 给工厂合约...");
  await myNFT.approve(await nftAuctionFactory.getAddress(), 0);

  // 创建拍卖
  console.log("创建拍卖...");
  const tx = await nftAuctionFactory.createAuction(
    await myNFT.getAddress(),
    deployer.address,
    0,
    startingPrice,
    reservePrice,
    duration
  );
  const receipt = await tx.wait();
  
  // 从事件中获取拍卖地址
  const event = receipt!.logs.find(log => 
    log.topics[0] === nftAuctionFactory.interface.getEvent("AuctionCreated").topicHash
  );
  const decodedEvent = nftAuctionFactory.interface.parseLog(event!);
  const auctionAddress = decodedEvent!.args.auctionAddress;

  console.log("拍卖创建成功!");
  console.log("拍卖合约地址:", auctionAddress);

  // 验证工厂识别
  const isFactoryAuction = await nftAuctionFactory.isFactoryAuction(auctionAddress);
  console.log("工厂识别该拍卖:", isFactoryAuction);

  // 获取拍卖总数
  const auctionCount = await nftAuctionFactory.allAuctionsLength();
  console.log("当前拍卖总数:", auctionCount.toString());

  console.log("\n--- 部署完成 ---");
  console.log("MyNFT 地址:", await myNFT.getAddress());
  console.log("MyToken 地址:", await myToken.getAddress());
  console.log("NFTAuctionFactory 地址:", await nftAuctionFactory.getAddress());
  console.log("创建的拍卖地址:", auctionAddress);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
