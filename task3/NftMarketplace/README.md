# NFT拍卖市场

一个基于Solidity的去中心化NFT拍卖市场，支持ETH和ERC20代币支付，采用UUPS可升级合约架构。

## 项目概述

这是一个完整的NFT拍卖市场解决方案，包含智能合约、测试脚本和部署工具。项目采用工厂模式创建拍卖合约，支持多币种支付，并集成了Chainlink价格预言机。

## 项目结构

```
NftMarketplace/
├── contracts/                    # 智能合约
│   ├── interfaces/              # 接口定义
│   │   ├── INFTAuction.sol      # NFT拍卖接口
│   │   ├── INFTAuctionFactory.sol # 拍卖工厂接口
│   │   ├── IPriceOracle.sol     # 价格预言机接口
│   │   └── Models.sol           # 数据模型和枚举
│   ├── ChainlinkPriceOracle.sol # Chainlink价格预言机实现
│   ├── MockAggregatorV3.sol     # Chainlink聚合器模拟合约
│   ├── MockPriceOracle.sol      # 价格预言机模拟合约
│   ├── MyNFT.sol                # 示例ERC721 NFT合约
│   ├── MyToken.sol              # 示例ERC20代币合约
│   ├── NFTAuctionFactory.sol    # 拍卖工厂合约（UUPS可升级）
│   └── SingleNFTAuction.sol     # 单件NFT拍卖合约
├── test/                        # 测试文件
│   ├── ChainlinkPriceOracle.ts  # 价格预言机测试
│   ├── MyNFT.ts                 # NFT合约测试
│   ├── MyToken.ts               # 代币合约测试
│   ├── NFTAuctionFactory.ts     # 拍卖工厂测试
│   └── SingleNFTAuction.ts      # 单件拍卖测试
├── scripts/                     # 部署脚本
│   └── deploy.ts                # 主部署脚本
├── typechain-types/             # TypeChain生成的类型定义
├── ignition/                    # Hardhat Ignition模块
├── hardhat.config.ts            # Hardhat配置
├── package.json                 # 项目依赖和脚本
└── tsconfig.json                # TypeScript配置
```

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

### 数据模型

#### 支付币种类型 (PaymentToken)
```solidity
enum PaymentToken {
    ETH,    // 以太坊原生代币
    ERC20   // ERC20标准代币
}
```

#### 拍卖状态 (AuctionStatus)
```solidity
enum AuctionStatus {
    NotStarted,  // 拍卖未开始
    Active,      // 拍卖进行中
    Ended,       // 拍卖已结束
    Cancelled    // 拍卖已取消
}
```

#### 拍卖信息 (AuctionInfo)
```solidity
struct AuctionInfo {
    address seller;              // 卖家地址
    address nftContract;         // NFT合约地址
    uint256 tokenId;             // NFT token ID
    uint256 startingPrice;       // 起拍价格
    uint256 reservePrice;        // 保留价格
    uint256 endTime;             // 拍卖结束时间
    address highestBidder;       // 当前最高出价者
    uint256 highestBid;          // 当前最高出价
    address erc20Token;          // ERC20代币地址
    PaymentToken paymentToken;   // 支付币种类型
    AuctionStatus status;        // 拍卖状态
    bool sellerClaimed;          // 卖家是否已领取资金
    bool highestBidderClaimed;   // 最高出价者是否已领取NFT
}
```

## 部署步骤

### 环境要求

- **Node.js**: 16.0 或更高版本
- **npm** 或 **yarn**: 包管理器
- **Hardhat**: 以太坊开发框架
- **以太坊钱包**: 如MetaMask
- **Infura账户**: 用于连接以太坊网络

### 1. 安装依赖

```bash
npm install
```

### 2. 环境配置

创建 `.env` 文件并配置以下环境变量：

```env
# Sepolia测试网配置
SEPOLIA_URL=https://sepolia.infura.io/v3/YOUR_INFURA_PROJECT_ID
ACCOUNT_PRIVATE_KEY=你的私钥（以0x开头）

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

部署脚本将按以下顺序部署合约：
1. **MyToken** - ERC20代币合约
2. **MyNFT** - ERC721 NFT合约
3. **ChainlinkPriceOracle** - 价格预言机合约
4. **NFTAuctionFactory** - 拍卖工厂合约（UUPS代理模式）

### 6. 验证合约（可选）

如果需要验证合约，可以使用Hardhat验证插件：

```bash
npx hardhat verify --network sepolia <合约地址> <构造函数参数>
```

## 使用指南

### 创建拍卖

#### 1. 通过工厂创建拍卖合约

```javascript
const factory = await ethers.getContractAt("NFTAuctionFactory", factoryAddress);
const tx = await factory.createAuction(sellerAddress);
const receipt = await tx.wait();

// 从事件中获取拍卖地址
const event = receipt.logs.find(log => 
  log.topics[0] === factory.interface.getEvent("AuctionCreated").topicHash
);
const decodedEvent = factory.interface.parseLog(event);
const auctionAddress = decodedEvent.args.auctionAddress;
```

#### 2. 配置并开始拍卖

```javascript
const auction = await ethers.getContractAt("SingleNFTAuction", auctionAddress);

// 设置价格预言机
await auction.setPriceOracle(priceOracleAddress);

// 授权NFT给拍卖合约
await nftContract.approve(auctionAddress, tokenId);

// 开始拍卖
await auction.startAuction(
  nftContractAddress,    // NFT合约地址
  tokenId,               // NFT token ID
  startingPrice,         // 起拍价格（wei）
  reservePrice,          // 保留价格（wei）
  duration,              // 拍卖时长（秒）
  paymentToken,          // 支付币种类型：0=ETH, 1=ERC20
  erc20TokenAddress      // ERC20代币地址（如果使用ERC20支付）
);
```

### 参与拍卖

#### 1. ETH出价

```javascript
const bidAmount = ethers.parseEther("1.5"); // 1.5 ETH
await auction.placeBidETH({ value: bidAmount });
```

#### 2. ERC20出价

```javascript
const bidAmount = ethers.parseUnits("1000", 18); // 1000 代币

// 首先授权代币
await tokenContract.approve(auctionAddress, bidAmount);

// 然后出价
await auction.placeBidERC20(bidAmount);
```

### 结束拍卖

#### 1. 结束拍卖

```javascript
await auction.endAuction();
```

#### 2. 卖家领取资金

```javascript
await auction.sellerClaimFunds();
```

#### 3. 买家领取NFT

```javascript
await auction.highestBidderClaimNFT();
```

### 提取未中标资金

#### 1. 提取ETH

```javascript
await auction.withdrawETH();
```

#### 2. 提取ERC20代币

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

# 生成TypeChain类型定义
npx hardhat typechain

# 运行覆盖率测试
npx hardhat coverage
```

## 测试说明

项目包含完整的测试套件，覆盖所有核心功能：

- **单元测试**: 测试单个合约的功能
- **集成测试**: 测试合约间的交互
- **边界测试**: 测试边界条件和异常情况

运行测试：
```bash
npm run test
```

## 安全特性

- **重入攻击防护**: 使用ReentrancyGuard防护重入攻击
- **权限控制**: 使用Ownable和访问控制确保权限安全
- **输入验证**: 所有输入参数都经过严格验证
- **资金安全**: 使用pull-over-push模式处理资金，避免push攻击
- **紧急提款**: 管理员可在异常情况下处理资金
- **Gas优化**: 通过存储优化和viaIR降低Gas消耗

## 技术栈

- **Solidity**: 0.8.28
- **Hardhat**: 以太坊开发框架
- **OpenZeppelin**: 合约安全库
- **TypeScript**: 类型安全的开发语言
- **Chainlink**: 去中心化价格预言机
- **Ethers.js**: Web3库
- **Chai**: 测试断言库
- **Mocha**: 测试框架

## 网络配置

### Sepolia测试网
- **RPC URL**: `https://sepolia.infura.io/v3/YOUR_PROJECT_ID`
- **Chain ID**: 11155111
- **ETH价格源**: `0x694AA1769357215DE4FAC081bf1f309aDC325306`

### 本地开发网络
- **RPC URL**: `http://127.0.0.1:8545`
- **Chain ID**: 31337

## 许可证

MIT License

## 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

## 支持

如有问题或建议，请通过以下方式联系：
- 创建 GitHub Issue
- 发送邮件至项目维护者

## 版本历史

- **v1.0.0**: 初始版本，包含完整的NFT拍卖市场功能
