# NFT拍卖市场

一个基于Solidity的去中心化NFT拍卖市场，支持ETH和ERC20代币支付，采用UUPS可升级合约架构。

## 功能特性

### 核心功能
- **NFT拍卖**: 支持单件NFT的拍卖功能
- **多币种支付**: 支持ETH和ERC20代币两种支付方式
- **价格预言机**: 集成Chainlink价格预言机，实时获取代币价格
- **可升级合约**: 采用UUPS代理模式，支持合约升级
- **工厂模式**: 通过工厂合约批量创建拍卖合约
- **安全机制**: 包含重入攻击防护、权限控制等安全特性

### 拍卖特性
- **起拍价和保留价**: 设置起拍价格和保留价格
- **拍卖时长**: 可自定义拍卖持续时间（最长30天）
- **出价机制**: 支持ETH和ERC20代币出价
- **资金安全**: 未中标资金可安全提取
- **拍卖状态管理**: 支持开始、结束、取消拍卖

### 技术特性
- **UUPS可升级**: 合约支持无状态升级
- **OpenZeppelin集成**: 使用标准库确保安全性
- **Gas优化**: 通过viaIR和优化器设置降低Gas消耗
- **TypeScript支持**: 完整的TypeScript开发环境

## 合约架构

### 核心合约

#### NFTAuctionFactory
- **功能**: 拍卖工厂合约，负责创建和管理拍卖合约
- **特性**: 
  - UUPS可升级代理模式
  - 协议费用管理
  - 批量创建拍卖合约
  - 权限控制

#### SingleNFTAuction
- **功能**: 单件NFT拍卖合约
- **特性**:
  - 支持ETH和ERC20代币支付
  - 价格预言机集成
  - 重入攻击防护
  - 资金安全提取
  - 紧急提款功能

#### ChainlinkPriceOracle
- **功能**: 价格预言机合约
- **特性**:
  - 集成Chainlink数据源
  - 获取ETH和ERC20代币价格
  - 支持多种价格源

#### MyNFT & MyToken
- **功能**: 示例NFT和代币合约
- **特性**:
  - ERC721和ERC20标准实现
  - 用于测试和演示

## 部署步骤

### 环境要求

- Node.js 16+
- npm 或 yarn
- Hardhat
- 以太坊钱包（如MetaMask）

### 1. 安装依赖

```bash
npm install
```

### 2. 环境配置

创建 `.env` 文件并配置以下环境变量：

```env
# Sepolia测试网配置
SEPOLIA_URL=https://sepolia.infura.io/v3/YOUR_INFURA_PROJECT_ID
ACCOUNT_PRIVATE_KEY=你的私钥

# Chainlink价格预言机配置
ETH_PRICE_FEED=0x694AA1769357215DE4FAC081bf1f309aDC325306  # Sepolia ETH/USD价格源
```

### 3. 编译合约

```bash
npm run compile
```

### 4. 运行测试

```bash
npm run test
```

### 5. 部署到Sepolia测试网

```bash
npm run deploy:sepolia
```

部署脚本将部署以下合约：
- MyToken (ERC20代币)
- MyNFT (ERC721 NFT)
- ChainlinkPriceOracle (价格预言机)
- NFTAuctionFactory (拍卖工厂，UUPS代理模式)

### 6. 验证合约（可选）

如果需要验证合约，可以使用Hardhat验证插件：

```bash
npx hardhat verify --network sepolia <合约地址> <构造函数参数>
```

## 使用指南

### 创建拍卖

1. **通过工厂创建拍卖**:
```javascript
const factory = await ethers.getContractAt("NFTAuctionFactory", factoryAddress);
const auctionAddress = await factory.createAuction(
  nftContract,
  seller,
  tokenId,
  startingPrice,
  reservePrice,
  duration
);
```

2. **设置拍卖参数**:
```javascript
const auction = await ethers.getContractAt("SingleNFTAuction", auctionAddress);
await auction.startAuction(
  nftContract,
  tokenId,
  startingPrice,
  reservePrice,
  duration,
  paymentToken, // 0 for ETH, 1 for ERC20
  erc20TokenAddress // 如果使用ERC20支付
);
```

### 参与拍卖

1. **ETH出价**:
```javascript
await auction.placeBidETH({ value: bidAmount });
```

2. **ERC20出价**:
```javascript
// 首先授权代币
await tokenContract.approve(auctionAddress, bidAmount);
// 然后出价
await auction.placeBidERC20(bidAmount);
```

### 结束拍卖

1. **结束拍卖**:
```javascript
await auction.endAuction();
```

2. **卖家领取资金**:
```javascript
await auction.sellerClaimFunds();
```

3. **买家领取NFT**:
```javascript
await auction.highestBidderClaimNFT();
```

### 提取未中标资金

1. **提取ETH**:
```javascript
await auction.withdrawETH();
```

2. **提取ERC20代币**:
```javascript
await auction.withdrawERC20(tokenAddress);
```

## 开发命令

```bash
# 编译合约
npm run compile

# 运行测试
npm run test

# 部署到Sepolia测试网
npm run deploy:sepolia

# 运行Hardhat节点（本地开发）
npx hardhat node

# 在本地网络部署
npx hardhat ignition deploy ./ignition/modules/Lock.ts --network localhost
```

## 安全特性

- **重入攻击防护**: 使用ReentrancyGuard
- **权限控制**: 使用Ownable和访问控制
- **输入验证**: 所有输入参数都经过验证
- **资金安全**: 使用pull-over-push模式处理资金
- **紧急提款**: 管理员可在异常情况下处理资金

## 技术栈

- **Solidity**: 0.8.28
- **Hardhat**: 开发框架
- **OpenZeppelin**: 合约库
- **TypeScript**: 类型安全
- **Chainlink**: 价格预言机
- **Ethers.js**: Web3库

## 许可证

MIT License
