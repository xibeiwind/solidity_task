import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("NFTAuction", function () {
  // 定义测试Fixture，用于在每个测试中复用相同的部署设置
  async function deployNFTAuctionFixture() {
    // 获取测试账户
    const [owner, seller, bidder1, bidder2, otherAccount] = await ethers.getSigners();

    // 部署 MyNFT 合约
    const MyNFT = await ethers.getContractFactory("MyNFT");
    const myNFT = await MyNFT.deploy();

    // 部署 MyToken 合约
    const MyToken = await ethers.getContractFactory("MyToken");
    const myToken = await MyToken.deploy();
    // 需要给bidder1和bidder2分配10000个代币
    await myToken.mint(bidder1.address, 500);
    await myToken.mint(bidder2.address, 500);


    // 部署 NFTAuction 合约
    const NFTAuction = await ethers.getContractFactory("NFTAuction");
    const nftAuction = await NFTAuction.deploy();

    // 铸造一些 NFT 给卖家用于测试
    const tokenURI = "https://example.com/token/1";
    await myNFT.safeMint(seller.address, tokenURI);

    return {
      nftAuction,
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
    it("应该正确设置合约所有者", async function () {
      const { nftAuction, owner } = await loadFixture(deployNFTAuctionFixture);

      expect(await nftAuction.owner()).to.equal(owner.address);
    });
  });

  describe("创建拍卖", function () {
    it("应该能够创建 ETH 拍卖", async function () {
      const { nftAuction, myNFT, seller } = await loadFixture(deployNFTAuctionFixture);

      const startingPrice = BigInt(1);
      const reservePrice = BigInt(2);
      const duration = 3600; // 1小时

      // 卖家授权 NFT 给拍卖合约
      await myNFT.connect(seller).approve(await nftAuction.getAddress(), 0);

      // 创建拍卖
      await expect(
        nftAuction.connect(seller).createAuction(
          await myNFT.getAddress(),
          0,
          startingPrice,
          reservePrice,
          duration,
          0, // PaymentToken.ETH
          ethers.ZeroAddress
        )
      ).to.emit(nftAuction, "AuctionCreated");

      // 验证拍卖信息
      const auction = await nftAuction.getAuction(0);
      expect(auction.seller).to.equal(seller.address);
      expect(auction.nftContract).to.equal(await myNFT.getAddress());
      expect(auction.tokenId).to.equal(0);
      expect(auction.startingPrice).to.equal(startingPrice);
      expect(auction.reservePrice).to.equal(reservePrice);
      expect(auction.paymentToken).to.equal(0); // ETH
      expect(auction.status).to.equal(0); // Active
    });

    it("应该能够创建 ERC20 拍卖", async function () {
      const { nftAuction, myNFT, myToken, seller } = await loadFixture(deployNFTAuctionFixture);

      const startingPrice = BigInt(100);
      const reservePrice = BigInt(200);
      const duration = 3600;

      // 卖家授权 NFT 给拍卖合约
      await myNFT.connect(seller).approve(await nftAuction.getAddress(), 0);

      // 创建拍卖
      await expect(
        nftAuction.connect(seller).createAuction(
          await myNFT.getAddress(),
          0,
          startingPrice,
          reservePrice,
          duration,
          1, // PaymentToken.ERC20
          await myToken.getAddress()
        )
      ).to.emit(nftAuction, "AuctionCreated");

      // 验证拍卖信息
      const auction = await nftAuction.getAuction(0);
      expect(auction.paymentToken).to.equal(1); // ERC20
      expect(auction.erc20Token).to.equal(await myToken.getAddress());
    });

    it("应该能够使用优化的创建拍卖函数", async function () {
      const { nftAuction, myNFT, seller } = await loadFixture(deployNFTAuctionFixture);

      const startingPrice = BigInt(1);
      const reservePrice = BigInt(2);
      const duration = 3600;

      // 卖家授权 NFT 给拍卖合约
      await myNFT.connect(seller).approve(await nftAuction.getAddress(), 0);

      // 使用优化的创建拍卖函数
      await expect(
        nftAuction.connect(seller).createAuctionOptimized({
          nftContract: await myNFT.getAddress(),
          tokenId: 0,
          startingPrice: startingPrice,
          reservePrice: reservePrice,
          duration: duration,
          paymentToken: 0, // ETH
          erc20Token: ethers.ZeroAddress
        })
      ).to.emit(nftAuction, "AuctionCreated");
    });

    it("创建拍卖时应该转移 NFT 到合约", async function () {
      const { nftAuction, myNFT, seller } = await loadFixture(deployNFTAuctionFixture);

      const startingPrice = BigInt(1);
      const reservePrice = BigInt(2);
      const duration = 3600;

      // 卖家授权 NFT 给拍卖合约
      await myNFT.connect(seller).approve(await nftAuction.getAddress(), 0);

      // 创建拍卖
      await nftAuction.connect(seller).createAuction(
        await myNFT.getAddress(),
        0,
        startingPrice,
        reservePrice,
        duration,
        0, // PaymentToken.ETH
        ethers.ZeroAddress
      );

      // 验证 NFT 所有权已转移到拍卖合约
      expect(await myNFT.ownerOf(0)).to.equal(await nftAuction.getAddress());
    });

    it("无效参数应该导致创建拍卖失败", async function () {
      const { nftAuction, myNFT, seller } = await loadFixture(deployNFTAuctionFixture);

      const startingPrice = BigInt(1);
      const reservePrice = BigInt(2);
      const duration = 3600;

      // 卖家授权 NFT 给拍卖合约
      await myNFT.connect(seller).approve(await nftAuction.getAddress(), 0);

      // 无效 NFT 合约地址
      await expect(
        nftAuction.connect(seller).createAuction(
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
        nftAuction.connect(seller).createAuction(
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
        nftAuction.connect(seller).createAuction(
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
        nftAuction.connect(seller).createAuction(
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
        nftAuction.connect(seller).createAuction(
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
  });

  describe("ETH 出价", function () {
    it("应该能够使用 ETH 出价", async function () {
      const { nftAuction, myNFT, seller, bidder1 } = await loadFixture(deployNFTAuctionFixture);
      const startingPrice = ethers.parseEther("1");
      const bidAmount = ethers.parseEther("1.5");

      // 创建拍卖
      await myNFT.connect(seller).approve(await nftAuction.getAddress(), 0);
      await nftAuction.connect(seller).createAuction(
        await myNFT.getAddress(),
        0,
        startingPrice,
        0, // 无保留价
        3600,
        0, // ETH
        ethers.ZeroAddress
      );


      // 出价
      await expect(
        nftAuction.connect(bidder1).placeBidETH(0, { value: bidAmount })
      ).to.emit(nftAuction, "BidPlaced")
        .withArgs(0, bidder1.address, bidAmount);

      // 验证拍卖信息更新
      const auction = await nftAuction.getAuction(0);
      expect(auction.highestBidder).to.equal(bidder1.address);
      expect(auction.highestBid).to.equal(bidAmount);
    });

    it("出价必须高于当前最高出价", async function () {
      const { nftAuction, myNFT, seller, bidder1, bidder2 } = await loadFixture(deployNFTAuctionFixture);

      const startingPrice = BigInt(1);

      // 创建拍卖
      await myNFT.connect(seller).approve(await nftAuction.getAddress(), 0);
      await nftAuction.connect(seller).createAuction(
        await myNFT.getAddress(),
        0,
        startingPrice,
        0,
        3600,
        0,
        ethers.ZeroAddress
      );

      // 第一个出价
      await nftAuction.connect(bidder1).placeBidETH(0, { value: ethers.parseEther("1.5") });

      // 第二个出价必须高于第一个
      await expect(
        nftAuction.connect(bidder2).placeBidETH(0, { value: ethers.parseEther("1.4") })
      ).to.be.revertedWith("Bid must be higher than current bid");
    });

    it("出价必须不低于起拍价格", async function () {
      const { nftAuction, myNFT, seller, bidder1 } = await loadFixture(deployNFTAuctionFixture);

      const startingPrice = ethers.parseEther("1");

      // 创建拍卖
      await myNFT.connect(seller).approve(await nftAuction.getAddress(), 0);
      await nftAuction.connect(seller).createAuction(
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
        nftAuction.connect(bidder1).placeBidETH(0, { value: ethers.parseEther("0.5") })
      ).to.be.revertedWith("Bid below starting price");
    });

    it("之前的出价者应该能够提取退款", async function () {
      const { nftAuction, myNFT, seller, bidder1, bidder2 } = await loadFixture(deployNFTAuctionFixture);

      const startingPrice = BigInt(1);

      // 创建拍卖
      await myNFT.connect(seller).approve(await nftAuction.getAddress(), 0);
      await nftAuction.connect(seller).createAuction(
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
      await nftAuction.connect(bidder1).placeBidETH(0, { value: bid1Amount });

      // 第二个出价（更高）
      const bid2Amount = ethers.parseEther("2");
      await nftAuction.connect(bidder2).placeBidETH(0, { value: bid2Amount });

      // 验证第一个出价者有退款
      expect(await nftAuction.getPendingReturns(bidder1.address)).to.equal(bid1Amount);

      // 提取退款
      const initialBalance = await ethers.provider.getBalance(bidder1.address);
      await nftAuction.connect(bidder1).withdrawETH();
      const finalBalance = await ethers.provider.getBalance(bidder1.address);

      // 验证余额增加（减去 gas 费用）
      expect(finalBalance).to.be.gt(initialBalance);
      expect(await nftAuction.getPendingReturns(bidder1.address)).to.equal(0);
    });
  });

  describe("ERC20 出价", function () {
    it("应该能够使用 ERC20 出价", async function () {
      const { nftAuction, myNFT, myToken, seller, bidder1 } = await loadFixture(deployNFTAuctionFixture);

      const startingPrice: bigint = BigInt(100);// BigInt(100);
      const bidAmount: bigint = BigInt(150);

      // 创建拍卖
      await myNFT.connect(seller).approve(await nftAuction.getAddress(), 0);
      await nftAuction.connect(seller).createAuction(
        await myNFT.getAddress(),
        0,
        startingPrice,
        0,
        3600,
        1, // ERC20
        await myToken.getAddress()
      );

      // 授权代币给拍卖合约
      await myToken.connect(bidder1).approve(await nftAuction.getAddress(), bidAmount);
      const allowance = await myToken.connect(bidder1).allowance(await bidder1.getAddress(), await nftAuction.getAddress());
      const balance = await myToken.balanceOf(await bidder1.getAddress());
      expect(allowance).to.equal(bidAmount);
      // 出价
      await expect(
        nftAuction.connect(bidder1).placeBidERC20(0, bidAmount)
      ).to.emit(nftAuction, "BidPlaced")
        .withArgs(0, bidder1.address, bidAmount);

      // 验证拍卖信息更新
      const auction = await nftAuction.getAuction(0);
      expect(auction.highestBidder).to.equal(bidder1.address);
      expect(auction.highestBid).to.equal(bidAmount);
    });

    it("ERC20 出价必须检查余额和授权", async function () {
      const { nftAuction, myNFT, myToken, seller, bidder1 } = await loadFixture(deployNFTAuctionFixture);

      const startingPrice = BigInt(100);
      const bidAmount = BigInt(600);

      // 创建拍卖
      await myNFT.connect(seller).approve(await nftAuction.getAddress(), 0);
      await nftAuction.connect(seller).createAuction(
        await myNFT.getAddress(),
        0,
        startingPrice,
        0,
        3600,
        1, // ERC20
        await myToken.getAddress()
      );
      const balance = await myToken.connect(bidder1).balanceOf(await bidder1.getAddress());
      // 未授权代币应该失败
      await expect(
        nftAuction.connect(bidder1).placeBidERC20(0, bidAmount)
      ).to.be.revertedWith("Insufficient allowance");

      // 授权但余额不足应该失败
      await myToken.connect(bidder1).approve(await nftAuction.getAddress(), bidAmount);
      await expect(
        nftAuction.connect(bidder1).placeBidERC20(0, bidAmount)
      ).to.be.revertedWith("Insufficient token balance");
    });

    it("ERC20 出价应该转移代币到合约", async function () {
      const { nftAuction, myNFT, myToken, seller, bidder1 } = await loadFixture(deployNFTAuctionFixture);

      const startingPrice = BigInt(100);
      const bidAmount = BigInt(150);

      // 创建拍卖
      await myNFT.connect(seller).approve(await nftAuction.getAddress(), 0);
      await nftAuction.connect(seller).createAuction(
        await myNFT.getAddress(),
        0,
        startingPrice,
        0,
        3600,
        1, // ERC20
        await myToken.getAddress()
      );

      // 授权代币
      await myToken.connect(bidder1).approve(await nftAuction.getAddress(), bidAmount);

      // 记录初始余额
      const initialContractBalance = await myToken.balanceOf(await nftAuction.getAddress());
      const initialBidderBalance = await myToken.balanceOf(bidder1.address);

      // 出价
      await nftAuction.connect(bidder1).placeBidERC20(0, bidAmount);

      // 验证代币转移
      expect(await myToken.balanceOf(await nftAuction.getAddress())).to.equal(initialContractBalance + bidAmount);
      expect(await myToken.balanceOf(bidder1.address)).to.equal(initialBidderBalance - bidAmount);
    });
  });

  describe("结束拍卖", function () {
    it("应该能够结束拍卖", async function () {
      const { nftAuction, myNFT, seller, bidder1 } = await loadFixture(deployNFTAuctionFixture);

      const startingPrice = BigInt(1);

      // 创建拍卖
      await myNFT.connect(seller).approve(await nftAuction.getAddress(), 0);
      await nftAuction.connect(seller).createAuction(
        await myNFT.getAddress(),
        0,
        startingPrice,
        0,
        5,
        0, // ETH
        ethers.ZeroAddress
      );

      // 出价
      await nftAuction.connect(bidder1).placeBidETH(0, { value: ethers.parseEther("1.5") });

      // 等待5秒
      await new Promise((resolve) => setTimeout(resolve, 5000));
      // 结束拍卖
      await expect(nftAuction.endAuction(0))
        .to.emit(nftAuction, "AuctionEnded")
        .withArgs(0, bidder1.address, ethers.parseEther("1.5"));

      // 验证拍卖状态已更新
      const auction = await nftAuction.getAuction(0);
      expect(auction.status).to.equal(1); // Ended
    });
  });

  describe("取消拍卖", function () {
    it("卖家应该能够取消拍卖", async function () {
      const { nftAuction, myNFT, seller } = await loadFixture(deployNFTAuctionFixture);

      const startingPrice = BigInt(1);

      // 创建拍卖
      await myNFT.connect(seller).approve(await nftAuction.getAddress(), 0);
      await nftAuction.connect(seller).createAuction(
        await myNFT.getAddress(),
        0,
        startingPrice,
        0,
        3600,
        0, // ETH
        ethers.ZeroAddress
      );

      // 取消拍卖
      await expect(nftAuction.connect(seller).cancelAuction(0))
        .to.emit(nftAuction, "AuctionCancelled")
        .withArgs(0);

      // 验证拍卖状态已更新
      const auction = await nftAuction.getAuction(0);
      expect(auction.status).to.equal(2); // Cancelled

      // 验证 NFT 已退回给卖家
      expect(await myNFT.ownerOf(0)).to.equal(seller.address);
    });

    it("非卖家不能取消拍卖", async function () {
      const { nftAuction, myNFT, seller, otherAccount } = await loadFixture(deployNFTAuctionFixture);

      const startingPrice = BigInt(1);

      // 创建拍卖
      await myNFT.connect(seller).approve(await nftAuction.getAddress(), 0);
      await nftAuction.connect(seller).createAuction(
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
        nftAuction.connect(otherAccount).cancelAuction(0)
      ).to.be.revertedWith("Only seller can cancel");
    });

    it("有出价的拍卖不能取消", async function () {
      const { nftAuction, myNFT, seller, bidder1 } = await loadFixture(deployNFTAuctionFixture);

      const startingPrice = BigInt(1);

      // 创建拍卖
      await myNFT.connect(seller).approve(await nftAuction.getAddress(), 0);
      await nftAuction.connect(seller).createAuction(
        await myNFT.getAddress(),
        0,
        startingPrice,
        0,
        3600,
        0, // ETH
        ethers.ZeroAddress
      );

      // 出价
      await nftAuction.connect(bidder1).placeBidETH(0, { value: ethers.parseEther("1.5") });

      // 尝试取消有出价的拍卖应该失败
      await expect(
        nftAuction.connect(seller).cancelAuction(0)
      ).to.be.revertedWith("Cannot cancel with bids");
    });
  });

  describe("资金提取", function () {
    it("应该能够提取 ERC20 代币", async function () {
      const { nftAuction, myNFT, myToken, seller, bidder1, bidder2 } = await loadFixture(deployNFTAuctionFixture);

      const startingPrice = BigInt(100);
      const bid1Amount = BigInt(150);
      const bid2Amount = BigInt(200);

      // 创建拍卖
      await myNFT.connect(seller).approve(await nftAuction.getAddress(), 0);
      await nftAuction.connect(seller).createAuction(
        await myNFT.getAddress(),
        0,
        startingPrice,
        0,
        3600,
        1, // ERC20
        await myToken.getAddress()
      );

      // 第一个出价
      await myToken.connect(bidder1).approve(await nftAuction.getAddress(), bid1Amount);
      await nftAuction.connect(bidder1).placeBidERC20(0, bid1Amount);

      // 第二个出价（更高）
      await myToken.connect(bidder2).approve(await nftAuction.getAddress(), bid2Amount);
      await nftAuction.connect(bidder2).placeBidERC20(0, bid2Amount);

      // 验证第一个出价者有代币退款
      expect(await nftAuction.getPendingTokenReturns(bidder1.address, await myToken.getAddress())).to.equal(bid1Amount);

      // 提取代币退款
      const initialBalance = await myToken.balanceOf(bidder1.address);
      await nftAuction.connect(bidder1).withdrawERC20(await myToken.getAddress());
      const finalBalance = await myToken.balanceOf(bidder1.address);

      // 验证余额增加
      expect(finalBalance).to.equal(initialBalance + bid1Amount);
      expect(await nftAuction.getPendingTokenReturns(bidder1.address, await myToken.getAddress())).to.equal(0);
    });
  });

  describe("查询函数", function () {
    it("应该能够查询拍卖信息", async function () {
      const { nftAuction, myNFT, seller } = await loadFixture(deployNFTAuctionFixture);

      const startingPrice = BigInt(1);
      const reservePrice = BigInt(2);
      const duration = 3600;

      // 创建拍卖
      await myNFT.connect(seller).approve(await nftAuction.getAddress(), 0);
      await nftAuction.connect(seller).createAuction(
        await myNFT.getAddress(),
        0,
        startingPrice,
        reservePrice,
        duration,
        0, // ETH
        ethers.ZeroAddress
      );

      // 查询拍卖信息
      const auction = await nftAuction.getAuction(0);
      expect(auction.seller).to.equal(seller.address);
      expect(auction.nftContract).to.equal(await myNFT.getAddress());
      expect(auction.tokenId).to.equal(0);
      expect(auction.startingPrice).to.equal(startingPrice);
      expect(auction.reservePrice).to.equal(reservePrice);
      expect(auction.paymentToken).to.equal(0);
      expect(auction.status).to.equal(0);
    });

    it("应该能够查询待提取资金", async function () {
      const { nftAuction, myNFT, seller, bidder1 } = await loadFixture(deployNFTAuctionFixture);

      const startingPrice = BigInt(1);

      // 创建拍卖
      await myNFT.connect(seller).approve(await nftAuction.getAddress(), 0);
      await nftAuction.connect(seller).createAuction(
        await myNFT.getAddress(),
        0,
        startingPrice,
        0,
        3600,
        0, // ETH
        ethers.ZeroAddress
      );

      // 查询初始待提取资金
      expect(await nftAuction.getPendingReturns(bidder1.address)).to.equal(0);

      // 出价
      await nftAuction.connect(bidder1).placeBidETH(0, { value: ethers.parseEther("1.5") });

      // 查询更新后的待提取资金
      expect(await nftAuction.getPendingReturns(bidder1.address)).to.equal(0);
    });
  });
});
