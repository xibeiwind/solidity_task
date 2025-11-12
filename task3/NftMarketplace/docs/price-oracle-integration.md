# Chainlink价格预言机集成指南

## 概述

本指南介绍了如何在NFT拍卖系统中集成Chainlink价格预言机，以支持ETH和ERC20代币的美元价值计算。

## 功能特性

- **实时价格查询**: 集成Chainlink价格源获取ETH和ERC20代币的实时美元价格
- **美元价值计算**: 在出价时自动计算并记录出价金额的美元价值
- **多代币支持**: 支持多种ERC20代币的价格查询
- **错误处理**: 优雅处理价格源不可用的情况
- **测试覆盖**: 提供完整的单元测试和集成测试

## 合约架构

### 核心合约

1. **IPriceOracle接口**
   - 定义价格预言机的标准接口
   - 支持ETH和ERC20代币价格查询

2. **ChainlinkPriceOracle实现**
   - 集成Chainlink AggregatorV3Interface
   - 支持价格缓存和验证
   - 提供价格源可用性检查

3. **NFTAuction增强**
   - 添加价格预言机引用
   - 在出价时计算美元价值
   - 更新事件包含美元价值字段

### 测试合约

1. **MockPriceOracle**
   - 用于测试环境的模拟价格预言机
   - 提供固定的ETH和代币价格

## 部署流程

### 1. 环境准备

确保已安装必要的依赖：
```bash
npm install
```

### 2. 配置环境变量

创建 `.env` 文件：
```env
SEPOLIA_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY
ACCOUNT_PRIVATE_KEY=your_private_key
```

### 3. 部署合约

使用提供的部署脚本：
```bash
npx hardhat run scripts/deploy-with-oracle.ts --network sepolia
```

### 4. 配置价格源

部署后需要配置代币价格源：
```javascript
// 配置DAI/USD价格源
await chainlinkPriceOracle.setTokenPriceFeed(
  daiTokenAddress,
  "0x14866185B1962B63C3Ea9E03Bc1da838bab34C19" // Sepolia DAI/USD
);
```

## 使用方法

### 创建拍卖

#### ETH拍卖
```javascript
await nftAuction.createAuction(
  nftContractAddress,
  tokenId,
  ethers.parseEther("1"), // 起拍价 1 ETH
  ethers.parseEther("2"), // 保留价 2 ETH
  3600, // 持续时间 1小时
  0, // PaymentToken.ETH
  ethers.ZeroAddress
);
```

#### ERC20拍卖
```javascript
await nftAuction.createAuction(
  nftContractAddress,
  tokenId,
  100, // 起拍价 100代币
  200, // 保留价 200代币
  3600, // 持续时间 1小时
  1, // PaymentToken.ERC20
  tokenAddress
);
```

### 出价

#### ETH出价
```javascript
await nftAuction.placeBidETH(auctionId, { value: ethers.parseEther("1.5") });
```

#### ERC20出价
```javascript
// 先授权代币
await token.approve(nftAuctionAddress, 150);
// 然后出价
await nftAuction.placeBidERC20(auctionId, 150);
```

### 监听事件

出价事件现在包含美元价值：
```javascript
nftAuction.on("BidPlaced", (auctionId, bidder, amount, amountInUSD) => {
  console.log(`出价: ${amount} ($${amountInUSD / 1e8})`);
});
```

## 价格源配置

### Sepolia测试网价格源

- **ETH/USD**: `0x694AA1769357215DE4FAC081bf1f309aDC325306`
- **DAI/USD**: `0x14866185B1962B63C3Ea9E03Bc1da838bab34C19`
- **USDC/USD**: `0xA2F78ab2355fe2f984D808B5CeE7FD0A93D5270E`

### 主网价格源

- **ETH/USD**: `0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419`
- **DAI/USD**: `0xAed0c38402a5d19df6E4c03F4E2DceD6e29c1ee9`
- **USDC/USD**: `0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6`

## 错误处理

### 价格源不可用

当价格源不可用时，系统会：
1. 返回0美元价值
2. 继续执行拍卖逻辑
3. 记录警告日志

### 常见错误

```javascript
// 检查价格源可用性
const isAvailable = await priceOracle.isPriceFeedAvailable(priceFeedAddress);

// 处理价格查询失败
try {
  const [price, timestamp] = await priceOracle.getETHPrice();
} catch (error) {
  console.log("价格查询失败");
}
```

## 测试

### 运行测试

```bash
# 运行所有测试
npx hardhat test

# 运行价格预言机集成测试
npx hardhat test test/PriceOracleIntegration.ts

# 运行特定测试文件
npx hardhat test test/NFTAuction.ts
```

### 测试覆盖

- 价格预言机设置和权限控制
- ETH和ERC20代币的美元价值计算
- 价格查询错误处理
- 小数和大金额的精度测试

## 安全考虑

### 价格新鲜度

系统检查价格时间戳，确保使用新鲜的价格数据：
- 价格缓存有效期：5分钟
- 价格新鲜度检查：2小时内

### 权限控制

- 只有合约所有者可以设置价格预言机
- 价格源配置需要有效地址验证

### 重入保护

所有关键函数都使用ReentrancyGuard防止重入攻击。

## 性能优化

### 价格缓存

- 实现5分钟的价格缓存机制
- 减少对Chainlink价格源的频繁调用
- 降低gas成本

### 存储优化

- 使用打包存储布局
- 最小化存储写入操作

## 扩展性

### 添加新代币

要支持新的ERC20代币，只需：
1. 配置对应的Chainlink价格源
2. 调用`setTokenPriceFeed`设置价格源地址

### 自定义价格预言机

可以轻松替换为其他价格预言机实现：
1. 实现`IPriceOracle`接口
2. 调用`setPriceOracle`设置新的预言机地址

## 故障排除

### 常见问题

1. **价格查询失败**
   - 检查价格源地址是否正确
   - 验证网络连接
   - 确认价格源是否可用

2. **美元价值为0**
   - 检查价格预言机是否设置
   - 验证价格查询是否成功
   - 查看事件日志排查问题

3. **权限错误**
   - 确认调用者是合约所有者
   - 检查函数修饰符

### 调试技巧

```javascript
// 启用详细日志
const debug = require("debug")("nft-auction:oracle");

// 检查价格预言机状态
console.log("Price Oracle:", await nftAuction.priceOracle());

// 验证价格源
const priceFeed = await priceOracle.getETHPriceFeed();
console.log("ETH Price Feed:", priceFeed);
```

## 相关链接

- [Chainlink文档](https://docs.chain.link/)
- [Chainlink价格源](https://docs.chain.link/data-feeds/price-feeds/addresses)
- [OpenZeppelin合约](https://docs.openzeppelin.com/contracts/)
- [Hardhat文档](https://hardhat.org/docs/)
