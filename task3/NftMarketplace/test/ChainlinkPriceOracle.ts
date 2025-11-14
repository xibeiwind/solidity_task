import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("ChainlinkPriceOracle", function () {
  // 定义测试夹具，用于在每个测试中复用相同的部署设置
  async function deployChainlinkPriceOracleFixture() {
    // 获取测试账户
    const [owner, otherAccount] = await ethers.getSigners();

    // 部署模拟ETH价格源
    const MockAggregatorV3 = await ethers.getContractFactory("MockAggregatorV3");
    const ethPriceFeed = await MockAggregatorV3.deploy(
      2000 * 1e8, // 2000美元，8位小数
      8, // 小数位数
      "ETH / USD" // 描述
    );

    // 部署模拟代币价格源
    const tokenPriceFeed = await MockAggregatorV3.deploy(
      1 * 1e8, // 1美元，8位小数
      8, // 小数位数
      "TOKEN / USD" // 描述
    );

    // 部署 ChainlinkPriceOracle 合约
    const ChainlinkPriceOracle = await ethers.getContractFactory("ChainlinkPriceOracle");
    const chainlinkPriceOracle = await ChainlinkPriceOracle.deploy(await ethPriceFeed.getAddress());

    // 创建测试代币地址
    const testToken = ethers.Wallet.createRandom().address;

    return {
      chainlinkPriceOracle,
      ethPriceFeed,
      tokenPriceFeed,
      testToken,
      owner,
      otherAccount
    };
  }

  describe("部署", function () {
    it("应该正确设置ETH价格源", async function () {
      const { chainlinkPriceOracle, ethPriceFeed } = await loadFixture(deployChainlinkPriceOracleFixture);

      expect(await chainlinkPriceOracle.getETHPriceFeed()).to.equal(await ethPriceFeed.getAddress());
    });

    it("不应该允许零地址作为ETH价格源", async function () {
      const ChainlinkPriceOracle = await ethers.getContractFactory("ChainlinkPriceOracle");
      
      await expect(ChainlinkPriceOracle.deploy(ethers.ZeroAddress))
        .to.be.revertedWith("Invalid ETH price feed");
    });
  });

  describe("设置代币价格源", function () {
    it("应该能够设置代币价格源", async function () {
      const { chainlinkPriceOracle, tokenPriceFeed, testToken } = await loadFixture(deployChainlinkPriceOracleFixture);

      await expect(chainlinkPriceOracle.setTokenPriceFeed(testToken, await tokenPriceFeed.getAddress()))
        .to.emit(chainlinkPriceOracle, "PriceFeedUpdated")
        .withArgs(testToken, await tokenPriceFeed.getAddress());

      expect(await chainlinkPriceOracle.getTokenPriceFeed(testToken)).to.equal(await tokenPriceFeed.getAddress());
    });

    it("不应该允许零地址作为代币地址", async function () {
      const { chainlinkPriceOracle, tokenPriceFeed } = await loadFixture(deployChainlinkPriceOracleFixture);

      await expect(chainlinkPriceOracle.setTokenPriceFeed(ethers.ZeroAddress, await tokenPriceFeed.getAddress()))
        .to.be.revertedWith("Invalid token address");
    });

    it("不应该允许零地址作为价格源地址", async function () {
      const { chainlinkPriceOracle, testToken } = await loadFixture(deployChainlinkPriceOracleFixture);

      await expect(chainlinkPriceOracle.setTokenPriceFeed(testToken, ethers.ZeroAddress))
        .to.be.revertedWith("Invalid price feed");
    });

    it("应该能够更新已存在的代币价格源", async function () {
      const { chainlinkPriceOracle, tokenPriceFeed, testToken } = await loadFixture(deployChainlinkPriceOracleFixture);

      // 第一次设置
      await chainlinkPriceOracle.setTokenPriceFeed(testToken, await tokenPriceFeed.getAddress());

      // 创建新的价格源
      const MockAggregatorV3 = await ethers.getContractFactory("MockAggregatorV3");
      const newTokenPriceFeed = await MockAggregatorV3.deploy(
        2 * 1e8, // 2美元，8位小数
        8, // 小数位数
        "TOKEN / USD" // 描述
      );

      // 更新价格源
      await expect(chainlinkPriceOracle.setTokenPriceFeed(testToken, await newTokenPriceFeed.getAddress()))
        .to.emit(chainlinkPriceOracle, "PriceFeedUpdated")
        .withArgs(testToken, await newTokenPriceFeed.getAddress());

      expect(await chainlinkPriceOracle.getTokenPriceFeed(testToken)).to.equal(await newTokenPriceFeed.getAddress());
    });
  });

  describe("获取ETH价格", function () {
    it("应该正确返回ETH价格", async function () {
      const { chainlinkPriceOracle } = await loadFixture(deployChainlinkPriceOracleFixture);

      const [price, timestamp] = await chainlinkPriceOracle.getETHPrice();

      expect(price).to.equal(2000 * 1e8); // 2000美元，8位小数
      expect(timestamp).to.be.gt(0);
    });
  });

  describe("获取代币价格", function () {
    it("应该正确返回代币价格", async function () {
      const { chainlinkPriceOracle, tokenPriceFeed, testToken } = await loadFixture(deployChainlinkPriceOracleFixture);

      // 设置代币价格源
      await chainlinkPriceOracle.setTokenPriceFeed(testToken, await tokenPriceFeed.getAddress());

      const [price, timestamp] = await chainlinkPriceOracle.getTokenPrice(testToken);

      expect(price).to.equal(1 * 1e8); // 1美元，8位小数
      expect(timestamp).to.be.gt(0);
    });

    it("应该在没有设置价格源时失败", async function () {
      const { chainlinkPriceOracle, testToken } = await loadFixture(deployChainlinkPriceOracleFixture);

      await expect(chainlinkPriceOracle.getTokenPrice(testToken))
        .to.be.revertedWith("Price feed not set for token");
    });
  });

  describe("价格缓存", function () {
    it("应该正确更新价格缓存", async function () {
      const { chainlinkPriceOracle, tokenPriceFeed, testToken } = await loadFixture(deployChainlinkPriceOracleFixture);

      // 设置代币价格源
      await chainlinkPriceOracle.setTokenPriceFeed(testToken, await tokenPriceFeed.getAddress());

      // 强制更新缓存
      await chainlinkPriceOracle.updatePriceCache(true);

      // 获取缓存信息
      const [price, timestamp, blockNumber] = await chainlinkPriceOracle.getPriceCache(await tokenPriceFeed.getAddress());

      expect(price).to.equal(1 * 1e8); // 1美元，8位小数
      expect(timestamp).to.be.gt(0);
      expect(blockNumber).to.be.gt(0);
    });

    it("应该返回正确的缓存有效期", async function () {
      const { chainlinkPriceOracle } = await loadFixture(deployChainlinkPriceOracleFixture);

      expect(await chainlinkPriceOracle.getCacheDuration()).to.equal(300); // 5分钟
    });

    it("应该正确判断缓存有效性", async function () {
      const { chainlinkPriceOracle, tokenPriceFeed, testToken } = await loadFixture(deployChainlinkPriceOracleFixture);

      // 设置代币价格源
      await chainlinkPriceOracle.setTokenPriceFeed(testToken, await tokenPriceFeed.getAddress());

      // 强制更新缓存
      await chainlinkPriceOracle.updatePriceCache(true);

      // 获取缓存信息
      const [price, timestamp, blockNumber] = await chainlinkPriceOracle.getPriceCache(await tokenPriceFeed.getAddress());

      // 缓存应该有效
      expect(price).to.equal(1 * 1e8);
      expect(timestamp).to.be.gt(0);
      expect(blockNumber).to.be.gt(0);
    });
  });

  describe("检查价格源可用性", function () {
    it("应该正确识别可用的价格源", async function () {
      const { chainlinkPriceOracle, ethPriceFeed } = await loadFixture(deployChainlinkPriceOracleFixture);

      expect(await chainlinkPriceOracle.isPriceFeedAvailable(await ethPriceFeed.getAddress())).to.be.true;
    });
  });

  describe("批量更新价格缓存", function () {
    it("应该能够批量更新所有价格缓存", async function () {
      const { chainlinkPriceOracle, tokenPriceFeed, testToken } = await loadFixture(deployChainlinkPriceOracleFixture);

      // 设置代币价格源
      await chainlinkPriceOracle.setTokenPriceFeed(testToken, await tokenPriceFeed.getAddress());

      // 更新价格缓存
      await chainlinkPriceOracle.updatePriceCache(false);

      // 验证缓存已更新
      const [price, timestamp] = await chainlinkPriceOracle.getPriceCache(await tokenPriceFeed.getAddress());
      expect(price).to.equal(1 * 1e8);
      expect(timestamp).to.be.gt(0);
    });

    it("应该能够强制更新价格缓存", async function () {
      const { chainlinkPriceOracle, tokenPriceFeed, testToken } = await loadFixture(deployChainlinkPriceOracleFixture);

      // 设置代币价格源
      await chainlinkPriceOracle.setTokenPriceFeed(testToken, await tokenPriceFeed.getAddress());

      // 强制更新价格缓存
      await chainlinkPriceOracle.updatePriceCache(true);

      // 验证缓存已更新
      const [price, timestamp] = await chainlinkPriceOracle.getPriceCache(await tokenPriceFeed.getAddress());
      expect(price).to.equal(1 * 1e8);
      expect(timestamp).to.be.gt(0);
    });
  });

  describe("集成测试", function () {
    it("应该正确处理多个代币的价格查询", async function () {
      const { chainlinkPriceOracle, tokenPriceFeed } = await loadFixture(deployChainlinkPriceOracleFixture);

      // 创建多个测试代币
      const token1 = ethers.Wallet.createRandom().address;
      const token2 = ethers.Wallet.createRandom().address;

      // 部署额外的价格源
      const MockAggregatorV3 = await ethers.getContractFactory("MockAggregatorV3");
      const tokenPriceFeed2 = await MockAggregatorV3.deploy(
        5 * 1e8, // 5美元，8位小数
        8, // 小数位数
        "TOKEN2 / USD" // 描述
      );

      // 设置多个代币价格源
      await chainlinkPriceOracle.setTokenPriceFeed(token1, await tokenPriceFeed.getAddress());
      await chainlinkPriceOracle.setTokenPriceFeed(token2, await tokenPriceFeed2.getAddress());

      // 验证每个代币的价格
      const [price1] = await chainlinkPriceOracle.getTokenPrice(token1);
      const [price2] = await chainlinkPriceOracle.getTokenPrice(token2);

      expect(price1).to.equal(1 * 1e8);
      expect(price2).to.equal(5 * 1e8);
    });
  });
});
