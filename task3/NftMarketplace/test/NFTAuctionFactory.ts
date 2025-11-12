import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { SingleNFTAuction } from "../typechain-types/contracts/SingleNFTAuction";

describe("NFTAuctionFactory", function () {
  // 定义测试Fixture，用于在每个测试中复用相同的部署设置
  async function deployNFTAuctionFactoryFixture() {
    // 获取测试账户
    const [owner, seller, bidder1, bidder2, otherAccount] = await ethers.getSigners();

    // 部署 MyNFT 合约
    const MyNFT = await ethers.getContractFactory("MyNFT");
    const myNFT = await MyNFT.deploy();

    // 部署 MyToken 合约
    const MyToken = await ethers.getContractFactory("MyToken");
    const myToken = await MyToken.deploy();

    // 部署 NFTAuctionFactory 合约
    const NFTAuctionFactory = await ethers.getContractFactory("NFTAuctionFactory");
    const nftAuctionFactory = await NFTAuctionFactory.deploy(owner.address);

    // 铸造一些 NFT 给卖家用于测试
    const tokenURI = "https://example.com/token/1";
    await myNFT.safeMint(seller.address, tokenURI);

    return {
      nftAuctionFactory,
      myNFT,
      myToken,
      owner,
      seller,
      bidder1,
      bidder2,
      otherAccount
    };
  }

  describe("部署", function () {
    it("应该正确设置费用设置者", async function () {
      const { nftAuctionFactory, owner } = await loadFixture(deployNFTAuctionFactoryFixture);

      expect(await nftAuctionFactory.feeToSetter()).to.equal(owner.address);
    });

    it("初始费用接收地址应该为零地址", async function () {
      const { nftAuctionFactory } = await loadFixture(deployNFTAuctionFactoryFixture);

      expect(await nftAuctionFactory.feeTo()).to.equal(ethers.ZeroAddress);
    });

    it("初始拍卖列表应该为空", async function () {
      const { nftAuctionFactory } = await loadFixture(deployNFTAuctionFactoryFixture);

      expect(await nftAuctionFactory.allAuctionsLength()).to.equal(0);
    });
  });

  describe("创建拍卖", function () {
    it("应该能够创建新的拍卖合约", async function () {
      const { nftAuctionFactory, myNFT, seller } = await loadFixture(deployNFTAuctionFactoryFixture);

      const startingPrice = ethers.parseEther("1");
      const reservePrice = ethers.parseEther("2");
      const duration = 3600; // 1小时

      // 创建拍卖
      await expect(
        nftAuctionFactory.createAuction(
          await myNFT.getAddress(),
          seller.address,
          0,
          startingPrice,
          reservePrice,
          duration
        )
      ).to.emit(nftAuctionFactory, "AuctionCreated");

      // 验证拍卖列表更新
      expect(await nftAuctionFactory.allAuctionsLength()).to.equal(1);
    });

    it("创建的拍卖合约应该被工厂识别", async function () {
      const { nftAuctionFactory, myNFT, seller } = await loadFixture(deployNFTAuctionFactoryFixture);

      const startingPrice = ethers.parseEther("1");
      const reservePrice = ethers.parseEther("2");
      const duration = 3600;

      // 创建拍卖
      const tx = await nftAuctionFactory.createAuction(
        await myNFT.getAddress(),
        seller.address,
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

      // 验证工厂识别该拍卖
      expect(await nftAuctionFactory.isFactoryAuction(auctionAddress)).to.be.true;
    });

    it("无效参数应该导致创建拍卖失败", async function () {
      const { nftAuctionFactory, myNFT, seller } = await loadFixture(deployNFTAuctionFactoryFixture);

      const startingPrice = ethers.parseEther("1");
      const reservePrice = ethers.parseEther("2");
      const duration = 3600;

      // 无效 NFT 合约地址
      await expect(
        nftAuctionFactory.createAuction(
          ethers.ZeroAddress,
          seller.address,
          0,
          startingPrice,
          reservePrice,
          duration
        )
      ).to.be.revertedWith("NFTAuctionFactory: nftContract is zero address");

      // 无效卖家地址
      await expect(
        nftAuctionFactory.createAuction(
          await myNFT.getAddress(),
          ethers.ZeroAddress,
          0,
          startingPrice,
          reservePrice,
          duration
        )
      ).to.be.revertedWith("NFTAuctionFactory: seller is zero address");

      // 无效起拍价格
      await expect(
        nftAuctionFactory.createAuction(
          await myNFT.getAddress(),
          seller.address,
          0,
          0,
          reservePrice,
          duration
        )
      ).to.be.revertedWith("NFTAuctionFactory: startingPrice is zero");

      // 无效持续时间
      await expect(
        nftAuctionFactory.createAuction(
          await myNFT.getAddress(),
          seller.address,
          0,
          startingPrice,
          reservePrice,
          0
        )
      ).to.be.revertedWith("NFTAuctionFactory: duration is zero");
    });

    it("应该能够创建多个拍卖合约", async function () {
      const { nftAuctionFactory, myNFT, seller } = await loadFixture(deployNFTAuctionFactoryFixture);

      const startingPrice = ethers.parseEther("1");
      const reservePrice = ethers.parseEther("2");
      const duration = 3600;

      // 创建第一个拍卖
      await nftAuctionFactory.createAuction(
        await myNFT.getAddress(),
        seller.address,
        0,
        startingPrice,
        reservePrice,
        duration
      );

      // 创建第二个拍卖
      await nftAuctionFactory.createAuction(
        await myNFT.getAddress(),
        seller.address,
        0,
        startingPrice,
        reservePrice,
        duration
      );

      // 验证拍卖列表更新
      expect(await nftAuctionFactory.allAuctionsLength()).to.equal(2);
    });
  });

  describe("费用设置", function () {
    it("费用设置者应该能够设置费用接收地址", async function () {
      const { nftAuctionFactory, owner, otherAccount } = await loadFixture(deployNFTAuctionFactoryFixture);

      // 设置费用接收地址
      await nftAuctionFactory.connect(owner).setFeeTo(otherAccount.address);

      expect(await nftAuctionFactory.feeTo()).to.equal(otherAccount.address);
    });

    it("非费用设置者不能设置费用接收地址", async function () {
      const { nftAuctionFactory, otherAccount } = await loadFixture(deployNFTAuctionFactoryFixture);

      // 非费用设置者尝试设置费用接收地址应该失败
      await expect(
        nftAuctionFactory.connect(otherAccount).setFeeTo(otherAccount.address)
      ).to.be.revertedWith("NFTAuctionFactory: FORBIDDEN");
    });

    it("费用设置者应该能够设置新的费用设置者", async function () {
      const { nftAuctionFactory, owner, otherAccount } = await loadFixture(deployNFTAuctionFactoryFixture);

      // 设置新的费用设置者
      await nftAuctionFactory.connect(owner).setFeeToSetter(otherAccount.address);

      expect(await nftAuctionFactory.feeToSetter()).to.equal(otherAccount.address);
    });

    it("非费用设置者不能设置新的费用设置者", async function () {
      const { nftAuctionFactory, otherAccount } = await loadFixture(deployNFTAuctionFactoryFixture);

      // 非费用设置者尝试设置新的费用设置者应该失败
      await expect(
        nftAuctionFactory.connect(otherAccount).setFeeToSetter(otherAccount.address)
      ).to.be.revertedWith("NFTAuctionFactory: FORBIDDEN");
    });
  });

  describe("集成测试", function () {
    it("通过工厂创建的拍卖应该能够正常工作", async function () {
      const { nftAuctionFactory, myNFT, myToken, seller, bidder1 } = await loadFixture(deployNFTAuctionFactoryFixture);

      const startingPrice = ethers.parseEther("1");
      const reservePrice = ethers.parseEther("2");
      const duration = 3600;

      // 创建拍卖
      const tx = await nftAuctionFactory.createAuction(
        await myNFT.getAddress(),
        seller.address,
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

      // 获取拍卖合约实例
      const SingleNFTAuction = await ethers.getContractFactory("SingleNFTAuction");
      // const auction = SingleNFTAuction.attach(auctionAddress) as SingleNFTAuction;
      const auction = SingleNFTAuction.attach(auctionAddress) as SingleNFTAuction;
      // 卖家授权 NFT 给拍卖合约
      await myNFT.connect(seller).approve(auctionAddress, 0);

      // 开始拍卖
      await auction.connect(seller).startAuction(
        await myNFT.getAddress(),
        0,
        startingPrice,
        reservePrice,
        duration,
        0, // PaymentToken.ETH
        ethers.ZeroAddress
      );

      // 出价
      const bidAmount = ethers.parseEther("1.5");
      await expect(
        auction.connect(bidder1).placeBidETH({ value: bidAmount })
      ).to.emit(auction, "BidPlaced")
        .withArgs(bidder1.address, bidAmount);

      // 验证拍卖信息更新
      const auctionInfo = await auction.getAuction();
      expect(auctionInfo.highestBidder).to.equal(bidder1.address);
      expect(auctionInfo.highestBid).to.equal(bidAmount);
    });

    it("应该能够查询所有创建的拍卖", async function () {
      const { nftAuctionFactory, myNFT, seller } = await loadFixture(deployNFTAuctionFactoryFixture);

      const startingPrice = ethers.parseEther("1");
      const reservePrice = ethers.parseEther("2");
      const duration = 3600;

      // 创建多个拍卖
      await nftAuctionFactory.createAuction(
        await myNFT.getAddress(),
        seller.address,
        0,
        startingPrice,
        reservePrice,
        duration
      );

      await nftAuctionFactory.createAuction(
        await myNFT.getAddress(),
        seller.address,
        0,
        startingPrice,
        reservePrice,
        duration
      );

      await nftAuctionFactory.createAuction(
        await myNFT.getAddress(),
        seller.address,
        0,
        startingPrice,
        reservePrice,
        duration
      );

      // 验证拍卖数量
      expect(await nftAuctionFactory.allAuctionsLength()).to.equal(3);

      // 验证可以获取拍卖地址
      const auction0 = await nftAuctionFactory.allAuctions(0);
      const auction1 = await nftAuctionFactory.allAuctions(1);
      const auction2 = await nftAuctionFactory.allAuctions(2);

      expect(auction0).to.not.equal(ethers.ZeroAddress);
      expect(auction1).to.not.equal(ethers.ZeroAddress);
      expect(auction2).to.not.equal(ethers.ZeroAddress);
      expect(auction0).to.not.equal(auction1);
      expect(auction1).to.not.equal(auction2);
    });
  });

  describe("工厂识别", function () {
    it("应该正确识别工厂创建的拍卖", async function () {
      const { nftAuctionFactory, myNFT, seller } = await loadFixture(deployNFTAuctionFactoryFixture);

      const startingPrice = ethers.parseEther("1");
      const reservePrice = ethers.parseEther("2");
      const duration = 3600;

      // 创建拍卖
      const tx = await nftAuctionFactory.createAuction(
        await myNFT.getAddress(),
        seller.address,
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

      // 验证工厂识别
      expect(await nftAuctionFactory.isFactoryAuction(auctionAddress)).to.be.true;

      // 验证非工厂创建的地址不被识别
      expect(await nftAuctionFactory.isFactoryAuction(seller.address)).to.be.false;
      expect(await nftAuctionFactory.isFactoryAuction(await myNFT.getAddress())).to.be.false;
    });
  });
});
