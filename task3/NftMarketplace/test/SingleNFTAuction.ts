import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers, upgrades } from "hardhat";

describe("SingleNFTAuction", function () {
  // 定义测试Fixture，用于在每个测试中复用相同的部署设置
  async function deploySingleNFTAuctionFixture() {
    // 获取测试账户
    const [owner, seller, bidder1, bidder2, otherAccount] = await ethers.getSigners();

    // 部署 MyNFT 合约
    const MyNFT = await ethers.getContractFactory("MyNFT");
    const myNFT = await MyNFT.deploy();

    // 部署 MyToken 合约
    const MyToken = await ethers.getContractFactory("MyToken");
    const myToken = await MyToken.deploy();

    // 需要给bidder1和bidder2分配10000个代币
    await myToken.mint(bidder1.address, 200);
    await myToken.mint(bidder2.address, 500);

    // 部署 MockPriceOracle 合约
    const MockPriceOracle = await ethers.getContractFactory("MockPriceOracle");
    const mockPriceOracle = await MockPriceOracle.deploy();

    // 部署 SingleNFTAuction 合约（可升级合约）
    const SingleNFTAuction = await ethers.getContractFactory("SingleNFTAuction");
    const singleNFTAuction = await upgrades.deployProxy(SingleNFTAuction, [owner.address, await mockPriceOracle.getAddress()]);
    await singleNFTAuction.waitForDeployment();

    // 铸造一些 NFT 给卖家用于测试
    const tokenURI = "https://example.com/token/1";
    await myNFT.safeMint(seller.address, tokenURI);

    return {
      singleNFTAuction,
      myNFT,
      myToken,
      mockPriceOracle,
      owner,
      seller,
      bidder1,
      bidder2,
      otherAccount
    };
  }

  describe("部署", function () {
    it("应该正确设置合约所有者", async function () {
      const { singleNFTAuction, owner } = await loadFixture(deploySingleNFTAuctionFixture);

      expect(await singleNFTAuction.owner()).to.equal(owner.address);
    });

    it("初始拍卖状态应该为未开始", async function () {
      const { singleNFTAuction } = await loadFixture(deploySingleNFTAuctionFixture);

      const auction = await singleNFTAuction.getAuction();
      expect(auction.status).to.equal(0); // NotStarted
    });

    it("应该正确设置价格预言机", async function () {
      const { singleNFTAuction, mockPriceOracle } = await loadFixture(deploySingleNFTAuctionFixture);

      expect(await singleNFTAuction.priceOracle()).to.equal(await mockPriceOracle.getAddress());
    });

    it("构造函数应该禁用初始化器", async function () {
      const SingleNFTAuction = await ethers.getContractFactory("SingleNFTAuction");
      const singleNFTAuction = await SingleNFTAuction.deploy();

      // 验证合约已部署
      expect(await singleNFTAuction.getAddress()).to.be.properAddress;
    });

    it("应该支持ERC721接收", async function () {
      const { singleNFTAuction } = await loadFixture(deploySingleNFTAuctionFixture);

      // 验证合约支持ERC721接收
      const selector = await singleNFTAuction.onERC721Received(
        ethers.ZeroAddress,
        ethers.ZeroAddress,
        0,
        "0x"
      );
      expect(selector).to.equal("0x150b7a02");
    });
  });

  describe("价格预言机", function () {
    it("应该能够设置价格预言机", async function () {
      const { singleNFTAuction, owner } = await loadFixture(deploySingleNFTAuctionFixture);

      // 部署新的 MockPriceOracle
      const MockPriceOracle = await ethers.getContractFactory("MockPriceOracle");
      const newMockPriceOracle = await MockPriceOracle.deploy();

      // 设置新的价格预言机
      await expect(singleNFTAuction.connect(owner).setPriceOracle(await newMockPriceOracle.getAddress()))
        .to.emit(singleNFTAuction, "PriceOracleUpdated")
        .withArgs(await newMockPriceOracle.getAddress());

      // 验证价格预言机已更新
      expect(await singleNFTAuction.priceOracle()).to.equal(await newMockPriceOracle.getAddress());
    });

    it("非所有者不能设置价格预言机", async function () {
      const { singleNFTAuction, otherAccount } = await loadFixture(deploySingleNFTAuctionFixture);

      // 部署新的 MockPriceOracle
      const MockPriceOracle = await ethers.getContractFactory("MockPriceOracle");
      const newMockPriceOracle = await MockPriceOracle.deploy();

      // 非所有者尝试设置价格预言机应该失败
      await expect(
        singleNFTAuction.connect(otherAccount).setPriceOracle(await newMockPriceOracle.getAddress())
      ).to.be.revertedWithCustomError(singleNFTAuction, "OwnableUnauthorizedAccount");
    });

    it("不能设置无效的价格预言机地址", async function () {
      const { singleNFTAuction, owner } = await loadFixture(deploySingleNFTAuctionFixture);

      // 尝试设置零地址应该失败
      await expect(
        singleNFTAuction.connect(owner).setPriceOracle(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid price oracle address");
    });

    it("ETH 出价应该计算美元价值", async function () {
      const { singleNFTAuction, myNFT, seller, bidder1, mockPriceOracle } = await loadFixture(deploySingleNFTAuctionFixture);

      const startingPrice = ethers.parseEther("1");
      const bidAmount = ethers.parseEther("1.5");

      // 创建拍卖
      await myNFT.connect(seller).approve(await singleNFTAuction.getAddress(), 0);
      await singleNFTAuction.connect(seller).startAuction(
        await myNFT.getAddress(),
        0,
        startingPrice,
        0,
        3600,
        0,
        ethers.ZeroAddress
      );

      // 获取 MockPriceOracle 的 ETH 价格
      const [ethPrice] = await mockPriceOracle.getETHPrice();

      // 计算预期的美元价值
      const expectedUSDValue = (bidAmount * ethPrice) / 10n ** 18n;

      // 出价并验证美元价值
      await expect(singleNFTAuction.connect(bidder1).placeBidETH({ value: bidAmount }))
        .to.emit(singleNFTAuction, "BidPlaced")
        .withArgs(bidder1.address, bidAmount, expectedUSDValue);
    });

    it("ERC20 出价应该计算美元价值", async function () {
      const { singleNFTAuction, myNFT, myToken, seller, bidder1, mockPriceOracle } = await loadFixture(deploySingleNFTAuctionFixture);

      const startingPrice = 100;
      const bidAmount = 150;

      // 创建拍卖
      await myNFT.connect(seller).approve(await singleNFTAuction.getAddress(), 0);
      await singleNFTAuction.connect(seller).startAuction(
        await myNFT.getAddress(),
        0,
        startingPrice,
        0,
        3600,
        1,
        await myToken.getAddress()
      );

      // 授权代币
      await myToken.connect(bidder1).approve(await singleNFTAuction.getAddress(), bidAmount);

      // 获取 MockPriceOracle 的代币价格
      const [tokenPrice] = await mockPriceOracle.getTokenPrice(await myToken.getAddress());

      // 计算预期的美元价值
      const expectedUSDValue = (BigInt(bidAmount) * tokenPrice) / 10n ** 18n;

      // 出价并验证美元价值
      await expect(singleNFTAuction.connect(bidder1).placeBidERC20(bidAmount))
        .to.emit(singleNFTAuction, "BidPlaced")
        .withArgs(bidder1.address, bidAmount, expectedUSDValue);
    });

    it("不可设置价格预言机为ZeroAddress", async function () {
      const { singleNFTAuction, myNFT, seller, bidder1, owner } = await loadFixture(deploySingleNFTAuctionFixture);

      const startingPrice = ethers.parseEther("1");

      // 创建拍卖
      await myNFT.connect(seller).approve(await singleNFTAuction.getAddress(), 0);
      await singleNFTAuction.connect(seller).startAuction(
        await myNFT.getAddress(),
        0,
        startingPrice,
        0,
        3600,
        0,
        ethers.ZeroAddress
      );

      // 不可设置价格预言机为ZeroAddress
      await expect(
        singleNFTAuction.connect(owner).setPriceOracle(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid price oracle address");

      // // 出价并验证美元价值为0
      // await expect(singleNFTAuction.connect(bidder1).placeBidETH({ value: bidAmount }))
      //   .to.emit(singleNFTAuction, "BidPlaced")
      //   .withArgs(bidder1.address, bidAmount, 0);
    });
  });

  describe("开始拍卖", function () {
    it("应该能够开始 ETH 拍卖", async function () {
      const { singleNFTAuction, myNFT, seller } = await loadFixture(deploySingleNFTAuctionFixture);

      const startingPrice = ethers.parseEther("1");
      const reservePrice = ethers.parseEther("2");
      const duration = 3600; // 1小时

      // 卖家授权 NFT 给拍卖合约
      await myNFT.connect(seller).approve(await singleNFTAuction.getAddress(), 0);

      // 开始拍卖
      await expect(
        singleNFTAuction.connect(seller).startAuction(
          await myNFT.getAddress(),
          0,
          startingPrice,
          reservePrice,
          duration,
          0, // PaymentToken.ETH
          ethers.ZeroAddress
        )
      ).to.emit(singleNFTAuction, "AuctionStarted");

      // 验证拍卖信息
      const auction = await singleNFTAuction.getAuction();
      expect(auction.seller).to.equal(seller.address);
      expect(auction.nftContract).to.equal(await myNFT.getAddress());
      expect(auction.tokenId).to.equal(0);
      expect(auction.startingPrice).to.equal(startingPrice);
      expect(auction.reservePrice).to.equal(reservePrice);
      expect(auction.paymentToken).to.equal(0); // ETH
      expect(auction.status).to.equal(1); // Active
    });

    it("应该能够开始 ERC20 拍卖", async function () {
      const { singleNFTAuction, myNFT, myToken, seller } = await loadFixture(deploySingleNFTAuctionFixture);

      const startingPrice = ethers.parseEther("100");
      const reservePrice = ethers.parseEther("200");
      const duration = 3600;

      // 卖家授权 NFT 给拍卖合约
      await myNFT.connect(seller).approve(await singleNFTAuction.getAddress(), 0);

      // 开始拍卖
      await expect(
        singleNFTAuction.connect(seller).startAuction(
          await myNFT.getAddress(),
          0,
          startingPrice,
          reservePrice,
          duration,
          1, // PaymentToken.ERC20
          await myToken.getAddress()
        )
      ).to.emit(singleNFTAuction, "AuctionStarted");

      // 验证拍卖信息
      const auction = await singleNFTAuction.getAuction();
      expect(auction.paymentToken).to.equal(1); // ERC20
      expect(auction.erc20Token).to.equal(await myToken.getAddress());
    });

    it("开始拍卖时应该转移 NFT 到合约", async function () {
      const { singleNFTAuction, myNFT, seller } = await loadFixture(deploySingleNFTAuctionFixture);

      const startingPrice = ethers.parseEther("1");
      const reservePrice = ethers.parseEther("2");
      const duration = 3600;

      // 卖家授权 NFT 给拍卖合约
      await myNFT.connect(seller).approve(await singleNFTAuction.getAddress(), 0);

      // 开始拍卖
      await singleNFTAuction.connect(seller).startAuction(
        await myNFT.getAddress(),
        0,
        startingPrice,
        reservePrice,
        duration,
        0, // PaymentToken.ETH
        ethers.ZeroAddress
      );

      // 验证 NFT 所有权已转移到拍卖合约
      expect(await myNFT.ownerOf(0)).to.equal(await singleNFTAuction.getAddress());
    });

    it("无效参数应该导致开始拍卖失败", async function () {
      const { singleNFTAuction, myNFT, seller } = await loadFixture(deploySingleNFTAuctionFixture);

      const startingPrice = ethers.parseEther("1");
      const reservePrice = ethers.parseEther("2");
      const duration = 3600;

      // 卖家授权 NFT 给拍卖合约
      await myNFT.connect(seller).approve(await singleNFTAuction.getAddress(), 0);

      // 无效 NFT 合约地址
      await expect(
        singleNFTAuction.connect(seller).startAuction(
          ethers.ZeroAddress,
          0,
          startingPrice,
          reservePrice,
          duration,
          0,
          ethers.ZeroAddress
        )
      ).to.be.revertedWith("Invalid NFT contract");

      // 无效起拍价格
      await expect(
        singleNFTAuction.connect(seller).startAuction(
          await myNFT.getAddress(),
          0,
          0,
          reservePrice,
          duration,
          0,
          ethers.ZeroAddress
        )
      ).to.be.revertedWith("Starting price must be > 0");

      // 无效持续时间
      await expect(
        singleNFTAuction.connect(seller).startAuction(
          await myNFT.getAddress(),
          0,
          startingPrice,
          reservePrice,
          0,
          0,
          ethers.ZeroAddress
        )
      ).to.be.revertedWith("Invalid duration");

      // 过长的持续时间
      await expect(
        singleNFTAuction.connect(seller).startAuction(
          await myNFT.getAddress(),
          0,
          startingPrice,
          reservePrice,
          31 * 24 * 3600, // 31天
          0,
          ethers.ZeroAddress
        )
      ).to.be.revertedWith("Invalid duration");

      // ERC20 拍卖但未提供代币地址
      await expect(
        singleNFTAuction.connect(seller).startAuction(
          await myNFT.getAddress(),
          0,
          startingPrice,
          reservePrice,
          duration,
          1, // ERC20
          ethers.ZeroAddress
        )
      ).to.be.revertedWith("Invalid ERC20 token");
    });

    it("拍卖已经开始后不能再次开始", async function () {
      const { singleNFTAuction, myNFT, seller } = await loadFixture(deploySingleNFTAuctionFixture);

      const startingPrice = ethers.parseEther("1");
      const reservePrice = ethers.parseEther("2");
      const duration = 3600;

      // 卖家授权 NFT 给拍卖合约
      await myNFT.connect(seller).approve(await singleNFTAuction.getAddress(), 0);

      // 开始第一次拍卖
      await singleNFTAuction.connect(seller).startAuction(
        await myNFT.getAddress(),
        0,
        startingPrice,
        reservePrice,
        duration,
        0,
        ethers.ZeroAddress
      );

      // 尝试再次开始拍卖应该失败
      await expect(
        singleNFTAuction.connect(seller).startAuction(
          await myNFT.getAddress(),
          0,
          startingPrice,
          reservePrice,
          duration,
          0,
          ethers.ZeroAddress
        )
      ).to.be.revertedWith("Auction already started");
    });
  });

  describe("ETH 出价", function () {
    it("应该能够使用 ETH 出价", async function () {
      const { singleNFTAuction, myNFT, seller, bidder1, mockPriceOracle } = await loadFixture(deploySingleNFTAuctionFixture);

      const startingPrice = ethers.parseEther("1");
      const bidAmount = ethers.parseEther("1.5");


      // 创建拍卖
      await myNFT.connect(seller).approve(await singleNFTAuction.getAddress(), 0);
      await singleNFTAuction.connect(seller).startAuction(
        await myNFT.getAddress(),
        0,
        startingPrice,
        0, // 无保留价
        3600,
        0, // ETH
        ethers.ZeroAddress
      );
      const [ethPrice] = await mockPriceOracle.getETHPrice();
      const priceInUSD = (bidAmount * ethPrice) / 10n ** 18n;
      // 出价
      await expect(
        singleNFTAuction.connect(bidder1).placeBidETH({ value: bidAmount })
      ).to.emit(singleNFTAuction, "BidPlaced")
        .withArgs(bidder1.address, bidAmount, priceInUSD);

      // 验证拍卖信息更新
      const auction = await singleNFTAuction.getAuction();
      expect(auction.highestBidder).to.equal(bidder1.address);
      expect(auction.highestBid).to.equal(bidAmount);
    });

    it("出价必须高于当前最高出价", async function () {
      const { singleNFTAuction, myNFT, seller, bidder1, bidder2 } = await loadFixture(deploySingleNFTAuctionFixture);

      const startingPrice = ethers.parseEther("1");

      // 创建拍卖
      await myNFT.connect(seller).approve(await singleNFTAuction.getAddress(), 0);
      await singleNFTAuction.connect(seller).startAuction(
        await myNFT.getAddress(),
        0,
        startingPrice,
        0,
        3600,
        0,
        ethers.ZeroAddress
      );

      // 第一个出价
      await singleNFTAuction.connect(bidder1).placeBidETH({ value: ethers.parseEther("1.5") });

      // 第二个出价必须高于第一个
      await expect(
        singleNFTAuction.connect(bidder2).placeBidETH({ value: ethers.parseEther("1.4") })
      ).to.be.revertedWith("Bid must be higher than current bid");
    });

    it("出价必须不低于起拍价格", async function () {
      const { singleNFTAuction, myNFT, seller, bidder1 } = await loadFixture(deploySingleNFTAuctionFixture);

      const startingPrice = ethers.parseEther("1");

      // 创建拍卖
      await myNFT.connect(seller).approve(await singleNFTAuction.getAddress(), 0);
      await singleNFTAuction.connect(seller).startAuction(
        await myNFT.getAddress(),
        0,
        startingPrice,
        0,
        3600,
        0,
        ethers.ZeroAddress
      );

      // 出价低于起拍价格应该失败
      await expect(
        singleNFTAuction.connect(bidder1).placeBidETH({ value: ethers.parseEther("0.5") })
      ).to.be.revertedWith("Bid below starting price");
    });

    it("之前的出价者应该能够提取退款", async function () {
      const { singleNFTAuction, myNFT, seller, bidder1, bidder2 } = await loadFixture(deploySingleNFTAuctionFixture);

      const startingPrice = ethers.parseEther("1");

      // 创建拍卖
      await myNFT.connect(seller).approve(await singleNFTAuction.getAddress(), 0);
      await singleNFTAuction.connect(seller).startAuction(
        await myNFT.getAddress(),
        0,
        startingPrice,
        0,
        3600,
        0,
        ethers.ZeroAddress
      );

      // 第一个出价
      const bid1Amount = ethers.parseEther("1.5");
      await singleNFTAuction.connect(bidder1).placeBidETH({ value: bid1Amount });

      // 第二个出价（更高）
      const bid2Amount = ethers.parseEther("2");
      await singleNFTAuction.connect(bidder2).placeBidETH({ value: bid2Amount });

      // 验证第一个出价者有退款
      expect(await singleNFTAuction.getPendingReturns(bidder1.address)).to.equal(bid1Amount);

      // 提取退款
      const initialBalance = await ethers.provider.getBalance(bidder1.address);
      const tx = await singleNFTAuction.connect(bidder1).withdrawETH();
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;
      const finalBalance = await ethers.provider.getBalance(bidder1.address);

      // 验证余额增加（减去 gas 费用）
      expect(finalBalance).to.be.closeTo(initialBalance + bid1Amount - gasUsed, ethers.parseEther("0.001"));
      expect(await singleNFTAuction.getPendingReturns(bidder1.address)).to.equal(0);
    });
  });

  describe("ERC20 出价", function () {
    it("应该能够使用 ERC20 出价", async function () {
      const { singleNFTAuction, mockPriceOracle, myNFT, myToken, seller, bidder1 } = await loadFixture(deploySingleNFTAuctionFixture);

      const startingPrice = 100;
      const bidAmount = BigInt(150);

      // 创建拍卖
      await myNFT.connect(seller).approve(await singleNFTAuction.getAddress(), 0);
      await singleNFTAuction.connect(seller).startAuction(
        await myNFT.getAddress(),
        0,
        startingPrice,
        0,
        3600,
        1, // ERC20
        await myToken.getAddress()
      );

      // 授权代币给拍卖合约
      await myToken.connect(bidder1).approve(await singleNFTAuction.getAddress(), bidAmount);

      const [tokenPrice] = await mockPriceOracle.getTokenPrice(await myToken.getAddress());
      const priceInUSD = (bidAmount * tokenPrice) / 10n ** 18n;
      // 出价
      await expect(
        singleNFTAuction.connect(bidder1).placeBidERC20(bidAmount)
      ).to.emit(singleNFTAuction, "BidPlaced")
        .withArgs(bidder1.address, bidAmount, priceInUSD);

      // 验证拍卖信息更新
      const auction = await singleNFTAuction.getAuction();
      expect(auction.highestBidder).to.equal(bidder1.address);
      expect(auction.highestBid).to.equal(bidAmount);
    });

    it("ERC20 出价必须检查余额和授权", async function () {
      const { singleNFTAuction, myNFT, myToken, seller, bidder1 } = await loadFixture(deploySingleNFTAuctionFixture);

      const startingPrice = 100;
      const bidAmount = 150;

      // 创建拍卖
      await myNFT.connect(seller).approve(await singleNFTAuction.getAddress(), 0);
      await singleNFTAuction.connect(seller).startAuction(
        await myNFT.getAddress(),
        0,
        startingPrice,
        0,
        3600,
        1, // ERC20
        await myToken.getAddress()
      );

      // 未授权代币应该失败
      await expect(
        singleNFTAuction.connect(bidder1).placeBidERC20(bidAmount)
      ).to.be.revertedWith("Insufficient allowance");

      // 授权但余额不足应该失败
      await myToken.connect(bidder1).approve(await singleNFTAuction.getAddress(), bidAmount);
      await expect(
        singleNFTAuction.connect(bidder1).placeBidERC20(ethers.parseEther("2000"))
      ).to.be.revertedWith("Insufficient token balance");
    });

    it("ERC20 出价应该转移代币到合约", async function () {
      const { singleNFTAuction, myNFT, myToken, seller, bidder1 } = await loadFixture(deploySingleNFTAuctionFixture);

      const startingPrice = BigInt(100);
      const bidAmount = BigInt(150);

      // 创建拍卖
      await myNFT.connect(seller).approve(await singleNFTAuction.getAddress(), 0);
      await singleNFTAuction.connect(seller).startAuction(
        await myNFT.getAddress(),
        0,
        startingPrice,
        0,
        3600,
        1, // ERC20
        await myToken.getAddress()
      );

      // 授权代币
      await myToken.connect(bidder1).approve(await singleNFTAuction.getAddress(), bidAmount);

      // 记录初始余额
      const initialContractBalance = await myToken.balanceOf(await singleNFTAuction.getAddress());
      const initialBidderBalance = await myToken.balanceOf(bidder1.address);

      // 出价
      await singleNFTAuction.connect(bidder1).placeBidERC20(bidAmount);

      // 验证代币转移
      expect(await myToken.balanceOf(await singleNFTAuction.getAddress())).to.equal(initialContractBalance + bidAmount);
      expect(await myToken.balanceOf(bidder1.address)).to.equal(initialBidderBalance - bidAmount);
    });
  });

  describe("结束拍卖", function () {
    it("应该能够结束拍卖", async function () {
      const { singleNFTAuction, myNFT, seller, bidder1 } = await loadFixture(deploySingleNFTAuctionFixture);

      const startingPrice = ethers.parseEther("1");

      // 创建拍卖
      await myNFT.connect(seller).approve(await singleNFTAuction.getAddress(), 0);
      await singleNFTAuction.connect(seller).startAuction(
        await myNFT.getAddress(),
        0,
        startingPrice,
        0,
        5,
        0, // ETH
        ethers.ZeroAddress
      );

      // 出价
      await singleNFTAuction.connect(bidder1).placeBidETH({ value: ethers.parseEther("1.5") });
      // 等待5秒
      await new Promise((resolve) => setTimeout(resolve, 5000));
      // 结束拍卖
      await expect(singleNFTAuction.endAuction())
        .to.emit(singleNFTAuction, "AuctionEnded")
        .withArgs(bidder1.address, ethers.parseEther("1.5"));

      // 验证拍卖状态已更新
      const auction = await singleNFTAuction.getAuction();
      expect(auction.status).to.equal(2); // Ended
    });
  });

  describe("取消拍卖", function () {
    it("卖家应该能够取消拍卖", async function () {
      const { singleNFTAuction, myNFT, seller } = await loadFixture(deploySingleNFTAuctionFixture);

      const startingPrice = ethers.parseEther("1");

      // 创建拍卖
      await myNFT.connect(seller).approve(await singleNFTAuction.getAddress(), 0);
      await singleNFTAuction.connect(seller).startAuction(
        await myNFT.getAddress(),
        0,
        startingPrice,
        0,
        3600,
        0, // ETH
        ethers.ZeroAddress
      );

      // 取消拍卖
      await expect(singleNFTAuction.connect(seller).cancelAuction())
        .to.emit(singleNFTAuction, "AuctionCancelled");

      // 验证拍卖状态已更新
      const auction = await singleNFTAuction.getAuction();
      expect(auction.status).to.equal(3); // Cancelled

      // 验证 NFT 已退回给卖家
      expect(await myNFT.ownerOf(0)).to.equal(seller.address);
    });

    it("非卖家不能取消拍卖", async function () {
      const { singleNFTAuction, myNFT, seller, otherAccount } = await loadFixture(deploySingleNFTAuctionFixture);

      const startingPrice = ethers.parseEther("1");

      // 创建拍卖
      await myNFT.connect(seller).approve(await singleNFTAuction.getAddress(), 0);
      await singleNFTAuction.connect(seller).startAuction(
        await myNFT.getAddress(),
        0,
        startingPrice,
        0,
        3600,
        0, // ETH
        ethers.ZeroAddress
      );

      // 非卖家尝试取消拍卖应该失败
      await expect(
        singleNFTAuction.connect(otherAccount).cancelAuction()
      ).to.be.revertedWith("Only seller can cancel");
    });

    it("有出价的拍卖不能取消", async function () {
      const { singleNFTAuction, myNFT, seller, bidder1 } = await loadFixture(deploySingleNFTAuctionFixture);

      const startingPrice = ethers.parseEther("1");

      // 创建拍卖
      await myNFT.connect(seller).approve(await singleNFTAuction.getAddress(), 0);
      await singleNFTAuction.connect(seller).startAuction(
        await myNFT.getAddress(),
        0,
        startingPrice,
        0,
        3600,
        0, // ETH
        ethers.ZeroAddress
      );

      // 出价
      await singleNFTAuction.connect(bidder1).placeBidETH({ value: ethers.parseEther("1.5") });

      // 尝试取消有出价的拍卖应该失败
      await expect(
        singleNFTAuction.connect(seller).cancelAuction()
      ).to.be.revertedWith("Cannot cancel with bids");
    });
  });

  describe("资金提取", function () {
    it("应该能够提取 ERC20 代币", async function () {
      const { singleNFTAuction, myNFT, myToken, seller, bidder1, bidder2 } = await loadFixture(deploySingleNFTAuctionFixture);

      const startingPrice = BigInt("100");
      const bid1Amount = BigInt("150");
      const bid2Amount = BigInt("200");

      // 创建拍卖
      await myNFT.connect(seller).approve(await singleNFTAuction.getAddress(), 0);
      await singleNFTAuction.connect(seller).startAuction(
        await myNFT.getAddress(),
        0,
        startingPrice,
        0,
        3600,
        1, // ERC20
        await myToken.getAddress()
      );

      // 第一个出价
      await myToken.connect(bidder1).approve(await singleNFTAuction.getAddress(), bid1Amount);
      await singleNFTAuction.connect(bidder1).placeBidERC20(bid1Amount);

      // 第二个出价（更高）
      await myToken.connect(bidder2).approve(await singleNFTAuction.getAddress(), bid2Amount);
      await singleNFTAuction.connect(bidder2).placeBidERC20(bid2Amount);

      // 验证第一个出价者有代币退款
      expect(await singleNFTAuction.getPendingTokenReturns(bidder1.address, await myToken.getAddress())).to.equal(bid1Amount);

      // 提取代币退款
      const initialBalance = await myToken.balanceOf(bidder1.address);
      await singleNFTAuction.connect(bidder1).withdrawERC20(await myToken.getAddress());
      const finalBalance = await myToken.balanceOf(bidder1.address);

      // 验证余额增加
      expect(finalBalance).to.equal(initialBalance + bid1Amount);
      expect(await singleNFTAuction.getPendingTokenReturns(bidder1.address, await myToken.getAddress())).to.equal(0);
    });
  });

  describe("查询函数", function () {
    it("应该能够查询拍卖信息", async function () {
      const { singleNFTAuction, myNFT, seller } = await loadFixture(deploySingleNFTAuctionFixture);

      const startingPrice = ethers.parseEther("1");
      const reservePrice = ethers.parseEther("2");
      const duration = 3600;

      // 创建拍卖
      await myNFT.connect(seller).approve(await singleNFTAuction.getAddress(), 0);
      await singleNFTAuction.connect(seller).startAuction(
        await myNFT.getAddress(),
        0,
        startingPrice,
        reservePrice,
        duration,
        0, // ETH
        ethers.ZeroAddress
      );

      // 查询拍卖信息
      const auction = await singleNFTAuction.getAuction();
      expect(auction.seller).to.equal(seller.address);
      expect(auction.nftContract).to.equal(await myNFT.getAddress());
      expect(auction.tokenId).to.equal(0);
      expect(auction.startingPrice).to.equal(startingPrice);
      expect(auction.reservePrice).to.equal(reservePrice);
      expect(auction.paymentToken).to.equal(0);
      expect(auction.status).to.equal(1);
    });

    it("应该能够查询待提取资金", async function () {
      const { singleNFTAuction, myNFT, seller, bidder1 } = await loadFixture(deploySingleNFTAuctionFixture);

      const startingPrice = ethers.parseEther("1");

      // 创建拍卖
      await myNFT.connect(seller).approve(await singleNFTAuction.getAddress(), 0);
      await singleNFTAuction.connect(seller).startAuction(
        await myNFT.getAddress(),
        0,
        startingPrice,
        0,
        3600,
        0, // ETH
        ethers.ZeroAddress
      );

      // 查询初始待提取资金
      expect(await singleNFTAuction.getPendingReturns(bidder1.address)).to.equal(0);

      // 出价
      await singleNFTAuction.connect(bidder1).placeBidETH({ value: ethers.parseEther("1.5") });

      // 查询更新后的待提取资金
      expect(await singleNFTAuction.getPendingReturns(bidder1.address)).to.equal(0);
    });
  });

  describe("拍卖结束后资金领取", function () {
    it("卖家应该能够领取ETH拍卖资金", async function () {
      const { singleNFTAuction, myNFT, seller, bidder1 } = await loadFixture(deploySingleNFTAuctionFixture);

      const startingPrice = ethers.parseEther("1");
      const bidAmount = ethers.parseEther("1.5");

      // 创建拍卖
      await myNFT.connect(seller).approve(await singleNFTAuction.getAddress(), 0);
      await singleNFTAuction.connect(seller).startAuction(
        await myNFT.getAddress(),
        0,
        startingPrice,
        0,
        5, // 短时间便于测试
        0, // ETH
        ethers.ZeroAddress
      );

      // 出价
      await singleNFTAuction.connect(bidder1).placeBidETH({ value: bidAmount });

      // 等待拍卖结束
      await new Promise((resolve) => setTimeout(resolve, 5000));

      // 结束拍卖
      await singleNFTAuction.endAuction();

      // 卖家领取资金
      const initialBalance = await ethers.provider.getBalance(seller.address);
      const tx = await singleNFTAuction.connect(seller).sellerClaimFunds();
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;
      const finalBalance = await ethers.provider.getBalance(seller.address);

      // 验证卖家收到资金（减去gas费用）
      expect(finalBalance).to.be.closeTo(initialBalance + bidAmount - gasUsed, ethers.parseEther("0.001"));

      // 验证卖家已领取标记
      const auction = await singleNFTAuction.getAuction();
      expect(auction.sellerClaimed).to.be.true;
    });

    it("卖家应该能够领取ERC20拍卖资金", async function () {
      const { singleNFTAuction, myNFT, myToken, seller, bidder1 } = await loadFixture(deploySingleNFTAuctionFixture);

      const startingPrice = 100;
      const bidAmount = 150;

      // 创建拍卖
      await myNFT.connect(seller).approve(await singleNFTAuction.getAddress(), 0);
      await singleNFTAuction.connect(seller).startAuction(
        await myNFT.getAddress(),
        0,
        startingPrice,
        0,
        5, // 短时间便于测试
        1, // ERC20
        await myToken.getAddress()
      );

      // 出价
      await myToken.connect(bidder1).approve(await singleNFTAuction.getAddress(), bidAmount);
      await singleNFTAuction.connect(bidder1).placeBidERC20(bidAmount);

      // 等待拍卖结束
      await new Promise((resolve) => setTimeout(resolve, 5000));

      // 结束拍卖
      await singleNFTAuction.endAuction();

      // 卖家领取资金
      const initialBalance = await myToken.balanceOf(seller.address);
      await singleNFTAuction.connect(seller).sellerClaimFunds();
      const finalBalance = await myToken.balanceOf(seller.address);

      // 验证卖家收到代币
      expect(finalBalance).to.equal(initialBalance + BigInt(bidAmount));

      // 验证卖家已领取标记
      const auction = await singleNFTAuction.getAuction();
      expect(auction.sellerClaimed).to.be.true;
    });

    it("未达到保留价格时NFT应该退回给卖家", async function () {
      const { singleNFTAuction, myNFT, seller, bidder1 } = await loadFixture(deploySingleNFTAuctionFixture);

      const startingPrice = ethers.parseEther("1");
      const reservePrice = ethers.parseEther("2"); // 保留价高于出价
      const bidAmount = ethers.parseEther("1.5");

      // 创建拍卖
      await myNFT.connect(seller).approve(await singleNFTAuction.getAddress(), 0);
      await singleNFTAuction.connect(seller).startAuction(
        await myNFT.getAddress(),
        0,
        startingPrice,
        reservePrice,
        5, // 短时间便于测试
        0, // ETH
        ethers.ZeroAddress
      );

      // 出价（低于保留价）
      await singleNFTAuction.connect(bidder1).placeBidETH({ value: bidAmount });

      // 等待拍卖结束
      await new Promise((resolve) => setTimeout(resolve, 5000));

      // 结束拍卖
      await singleNFTAuction.endAuction();

      // 卖家领取资金（应该退回NFT）
      await singleNFTAuction.connect(seller).sellerClaimFunds();

      // 验证NFT已退回给卖家
      expect(await myNFT.ownerOf(0)).to.equal(seller.address);
    });

    it("最高出价者应该能够领取NFT", async function () {
      const { singleNFTAuction, myNFT, seller, bidder1 } = await loadFixture(deploySingleNFTAuctionFixture);

      const startingPrice = ethers.parseEther("1");
      const bidAmount = ethers.parseEther("1.5");

      // 创建拍卖
      await myNFT.connect(seller).approve(await singleNFTAuction.getAddress(), 0);
      await singleNFTAuction.connect(seller).startAuction(
        await myNFT.getAddress(),
        0,
        startingPrice,
        0,
        5, // 短时间便于测试
        0, // ETH
        ethers.ZeroAddress
      );

      // 出价
      await singleNFTAuction.connect(bidder1).placeBidETH({ value: bidAmount });

      // 等待拍卖结束
      await new Promise((resolve) => setTimeout(resolve, 5000));

      // 结束拍卖
      await singleNFTAuction.endAuction();

      // 卖家领取资金
      await singleNFTAuction.connect(seller).sellerClaimFunds();

      // 最高出价者领取NFT
      await singleNFTAuction.connect(bidder1).highestBidderClaimNFT();

      // 验证NFT已转移给最高出价者
      expect(await myNFT.ownerOf(0)).to.equal(bidder1.address);

      // 验证最高出价者已领取标记
      const auction = await singleNFTAuction.getAuction();
      expect(auction.highestBidderClaimed).to.be.true;
    });

    it("非卖家不能领取资金", async function () {
      const { singleNFTAuction, myNFT, seller, bidder1, otherAccount } = await loadFixture(deploySingleNFTAuctionFixture);

      const startingPrice = ethers.parseEther("1");
      const bidAmount = ethers.parseEther("1.5");

      // 创建拍卖
      await myNFT.connect(seller).approve(await singleNFTAuction.getAddress(), 0);
      await singleNFTAuction.connect(seller).startAuction(
        await myNFT.getAddress(),
        0,
        startingPrice,
        0,
        5, // 短时间便于测试
        0, // ETH
        ethers.ZeroAddress
      );

      // 出价
      await singleNFTAuction.connect(bidder1).placeBidETH({ value: bidAmount });

      // 等待拍卖结束
      await new Promise((resolve) => setTimeout(resolve, 5000));

      // 结束拍卖
      await singleNFTAuction.endAuction();

      // 非卖家尝试领取资金应该失败
      await expect(
        singleNFTAuction.connect(otherAccount).sellerClaimFunds()
      ).to.be.revertedWith("Only seller can claim");
    });

    it("非最高出价者不能领取NFT", async function () {
      const { singleNFTAuction, myNFT, seller, bidder1, otherAccount } = await loadFixture(deploySingleNFTAuctionFixture);

      const startingPrice = ethers.parseEther("1");
      const bidAmount = ethers.parseEther("1.5");

      // 创建拍卖
      await myNFT.connect(seller).approve(await singleNFTAuction.getAddress(), 0);
      await singleNFTAuction.connect(seller).startAuction(
        await myNFT.getAddress(),
        0,
        startingPrice,
        0,
        5, // 短时间便于测试
        0, // ETH
        ethers.ZeroAddress
      );

      // 出价
      await singleNFTAuction.connect(bidder1).placeBidETH({ value: bidAmount });

      // 等待拍卖结束
      await new Promise((resolve) => setTimeout(resolve, 5000));

      // 结束拍卖
      await singleNFTAuction.endAuction();

      // 卖家领取资金
      await singleNFTAuction.connect(seller).sellerClaimFunds();

      // 非最高出价者尝试领取NFT应该失败
      await expect(
        singleNFTAuction.connect(otherAccount).highestBidderClaimNFT()
      ).to.be.revertedWith("Only highest bidder can claim");
    });
  });

  describe("紧急提款功能", function () {
    it("所有者应该能够执行紧急提款", async function () {
      const { singleNFTAuction, myNFT, seller, bidder1 } = await loadFixture(deploySingleNFTAuctionFixture);

      const startingPrice = ethers.parseEther("1");
      const bidAmount = ethers.parseEther("1.5");

      // 创建拍卖
      await myNFT.connect(seller).approve(await singleNFTAuction.getAddress(), 0);
      await singleNFTAuction.connect(seller).startAuction(
        await myNFT.getAddress(),
        0,
        startingPrice,
        0,
        5, // 短时间便于测试
        0, // ETH
        ethers.ZeroAddress
      );

      // 出价
      await singleNFTAuction.connect(bidder1).placeBidETH({ value: bidAmount });

      // 等待拍卖结束
      await new Promise((resolve) => setTimeout(resolve, 5000));

      // 结束拍卖
      await singleNFTAuction.endAuction();

      // 模拟时间流逝（30天后）
      await ethers.provider.send("evm_increaseTime", [30 * 24 * 3600 + 1]);
      await ethers.provider.send("evm_mine", []);

      // 执行紧急提款
      await singleNFTAuction.emergencyWithdraw();

      // 验证资金已转移给卖家
      const auction = await singleNFTAuction.getAuction();
      expect(auction.sellerClaimed).to.be.true;
    });

    it("非所有者不能执行紧急提款", async function () {
      const { singleNFTAuction, myNFT, seller, bidder1, otherAccount } = await loadFixture(deploySingleNFTAuctionFixture);

      const startingPrice = ethers.parseEther("1");
      const bidAmount = ethers.parseEther("1.5");

      // 创建拍卖
      await myNFT.connect(seller).approve(await singleNFTAuction.getAddress(), 0);
      await singleNFTAuction.connect(seller).startAuction(
        await myNFT.getAddress(),
        0,
        startingPrice,
        0,
        5, // 短时间便于测试
        0, // ETH
        ethers.ZeroAddress
      );

      // 出价
      await singleNFTAuction.connect(bidder1).placeBidETH({ value: bidAmount });

      // 等待拍卖结束
      await new Promise((resolve) => setTimeout(resolve, 5000));

      // 结束拍卖
      await singleNFTAuction.endAuction();

      // 模拟时间流逝（30天后）
      await ethers.provider.send("evm_increaseTime", [30 * 24 * 3600 + 1]);
      await ethers.provider.send("evm_mine", []);

      // 非所有者尝试紧急提款应该失败
      await expect(
        singleNFTAuction.connect(otherAccount).emergencyWithdraw()
      ).to.be.revertedWithCustomError(singleNFTAuction, "OwnableUnauthorizedAccount");
    });

    it("紧急提款不能在30天内执行", async function () {
      const { singleNFTAuction, myNFT, seller, bidder1 } = await loadFixture(deploySingleNFTAuctionFixture);

      const startingPrice = ethers.parseEther("1");
      const bidAmount = ethers.parseEther("1.5");

      // 创建拍卖
      await myNFT.connect(seller).approve(await singleNFTAuction.getAddress(), 0);
      await singleNFTAuction.connect(seller).startAuction(
        await myNFT.getAddress(),
        0,
        startingPrice,
        0,
        5, // 短时间便于测试
        0, // ETH
        ethers.ZeroAddress
      );

      // 出价
      await singleNFTAuction.connect(bidder1).placeBidETH({ value: bidAmount });

      // 等待拍卖结束
      await new Promise((resolve) => setTimeout(resolve, 5000));

      // 结束拍卖
      await singleNFTAuction.endAuction();

      // 尝试在30天内执行紧急提款应该失败
      await expect(
        singleNFTAuction.emergencyWithdraw()
      ).to.be.revertedWith("Too early for emergency withdrawal");
    });
  });

  describe("边界情况测试", function () {
    it("应该处理零保留价格的情况", async function () {
      const { singleNFTAuction, myNFT, seller, bidder1 } = await loadFixture(deploySingleNFTAuctionFixture);

      const startingPrice = ethers.parseEther("1");
      const bidAmount = ethers.parseEther("1.5");

      // 创建拍卖（零保留价格）
      await myNFT.connect(seller).approve(await singleNFTAuction.getAddress(), 0);
      await singleNFTAuction.connect(seller).startAuction(
        await myNFT.getAddress(),
        0,
        startingPrice,
        0, // 零保留价格
        5, // 短时间便于测试
        0, // ETH
        ethers.ZeroAddress
      );

      // 出价
      await singleNFTAuction.connect(bidder1).placeBidETH({ value: bidAmount });

      // 等待拍卖结束
      await new Promise((resolve) => setTimeout(resolve, 5000));

      // 结束拍卖
      await singleNFTAuction.endAuction();

      // 卖家领取资金
      await singleNFTAuction.connect(seller).sellerClaimFunds();

      // 最高出价者领取NFT
      await singleNFTAuction.connect(bidder1).highestBidderClaimNFT();

      // 验证NFT已转移给最高出价者
      expect(await myNFT.ownerOf(0)).to.equal(bidder1.address);
    });

    it("应该处理无出价的情况", async function () {
      const { singleNFTAuction, myNFT, seller } = await loadFixture(deploySingleNFTAuctionFixture);

      const startingPrice = ethers.parseEther("1");

      // 创建拍卖
      await myNFT.connect(seller).approve(await singleNFTAuction.getAddress(), 0);
      await singleNFTAuction.connect(seller).startAuction(
        await myNFT.getAddress(),
        0,
        startingPrice,
        0,
        5, // 短时间便于测试
        0, // ETH
        ethers.ZeroAddress
      );

      // 等待拍卖结束（无出价）
      await new Promise((resolve) => setTimeout(resolve, 5000));

      // 结束拍卖
      await singleNFTAuction.endAuction();

      // 卖家领取资金（应该退回NFT）
      await singleNFTAuction.connect(seller).sellerClaimFunds();

      // 验证NFT已退回给卖家
      expect(await myNFT.ownerOf(0)).to.equal(seller.address);
    });

    it("应该处理预言机故障的情况", async function () {
      const { singleNFTAuction, mockPriceOracle, myNFT, seller, bidder1 } = await loadFixture(deploySingleNFTAuctionFixture);

      const startingPrice = ethers.parseEther("1");
      const bidAmount = ethers.parseEther("1.5");

      // 创建拍卖
      await myNFT.connect(seller).approve(await singleNFTAuction.getAddress(), 0);
      await singleNFTAuction.connect(seller).startAuction(
        await myNFT.getAddress(),
        0,
        startingPrice,
        0,
        3600,
        0, // ETH
        ethers.ZeroAddress
      );

      // 设置无效的价格预言机地址
      await mockPriceOracle.setETHPrice(0 * 1e8);
      await mockPriceOracle.setTokenPrice(ethers.ZeroAddress, 0 * 1e8);

      // 出价（应该成功，但美元价值为0）
      await expect(singleNFTAuction.connect(bidder1).placeBidETH({ value: bidAmount }))
        .to.emit(singleNFTAuction, "BidPlaced")
        .withArgs(bidder1.address, bidAmount, 0);
    });

    it("应该处理极端价格情况", async function () {
      const { singleNFTAuction, myNFT, seller, bidder1 } = await loadFixture(deploySingleNFTAuctionFixture);

      const startingPrice = ethers.parseEther("1000"); // 高起拍价
      const bidAmount = ethers.parseEther("1001"); // 略高于起拍价

      // 创建拍卖
      await myNFT.connect(seller).approve(await singleNFTAuction.getAddress(), 0);
      await singleNFTAuction.connect(seller).startAuction(
        await myNFT.getAddress(),
        0,
        startingPrice,
        0,
        3600,
        0, // ETH
        ethers.ZeroAddress
      );

      // 出价
      await singleNFTAuction.connect(bidder1).placeBidETH({ value: bidAmount });

      // 验证拍卖信息更新
      const auction = await singleNFTAuction.getAuction();
      expect(auction.highestBidder).to.equal(bidder1.address);
      expect(auction.highestBid).to.equal(bidAmount);
    });

    it("应该处理重复提取的情况", async function () {
      const { singleNFTAuction, myNFT, seller, bidder1, bidder2 } = await loadFixture(deploySingleNFTAuctionFixture);

      const startingPrice = ethers.parseEther("1");

      // 创建拍卖
      await myNFT.connect(seller).approve(await singleNFTAuction.getAddress(), 0);
      await singleNFTAuction.connect(seller).startAuction(
        await myNFT.getAddress(),
        0,
        startingPrice,
        0,
        3600,
        0, // ETH
        ethers.ZeroAddress
      );

      // 第一个出价
      const bid1Amount = ethers.parseEther("1.5");
      await singleNFTAuction.connect(bidder1).placeBidETH({ value: bid1Amount });

      // 第二个出价（更高）
      const bid2Amount = ethers.parseEther("2");
      await singleNFTAuction.connect(bidder2).placeBidETH({ value: bid2Amount });

      // 提取退款
      await singleNFTAuction.connect(bidder1).withdrawETH();

      // 尝试重复提取应该失败
      await expect(
        singleNFTAuction.connect(bidder1).withdrawETH()
      ).to.be.revertedWith("No pending returns");
    });
  });
});
