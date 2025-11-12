# SingleNFTAuction 合约

## 概述

`SingleNFTAuction` 是一个专门处理单个 NFT 拍卖的智能合约，参考了现有的 `NFTAuction` 合约实现。该合约设计用于处理单个 NFT 的拍卖流程，支持 ETH 和 ERC20 两种支付方式。

## 核心特性

### 1. 单一 NFT 拍卖
- 合约专门处理单个 NFT 的拍卖
- 无需拍卖 ID 系统，简化管理
- 部署后即可绑定特定 NFT 进行拍卖

### 2. 支付方式支持
- **ETH 支付**: 使用原生以太币进行出价
- **ERC20 支付**: 支持任意 ERC20 代币进行出价

### 3. 拍卖参数
- **起拍价**: 拍卖开始时的最低出价
- **保留价**: 卖家可接受的最低成交价（可选）
- **持续时间**: 拍卖持续的时间（最长30天）

### 4. 安全特性
- 重入攻击防护（ReentrancyGuard）
- 权限控制（Ownable）
- 安全的资金提取机制
- 参数验证和边界检查

## 合约架构

### 继承关系
```solidity
SingleNFTAuction is ReentrancyGuard, IERC721Receiver, Ownable
```

### 主要数据结构

#### 拍卖状态枚举
```solidity
enum AuctionStatus {
    NotStarted,  // 拍卖未开始
    Active,      // 拍卖进行中
    Ended,       // 拍卖已结束
    Cancelled    // 拍卖已取消
}
```

#### 支付方式枚举
```solidity
enum PaymentToken {
    ETH,    // 以太坊原生代币
    ERC20   // ERC20标准代币
}
```

#### 拍卖信息结构体
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

## 主要功能

### 1. 开始拍卖
```solidity
function startAuction(
    address nftContract,
    uint256 tokenId,
    uint256 startingPrice,
    uint256 reservePrice,
    uint256 duration,
    PaymentToken paymentToken,
    address erc20Token
) external nonReentrant
```

### 2. 出价功能
- **ETH 出价**: `placeBidETH()` - 使用 ETH 进行出价
- **ERC20 出价**: `placeBidERC20(uint256 amount)` - 使用 ERC20 代币进行出价

### 3. 拍卖管理
- **结束拍卖**: `endAuction()` - 手动结束拍卖
- **取消拍卖**: `cancelAuction()` - 卖家取消拍卖（仅限无人出价时）

### 4. 资金提取
- **卖家提取资金**: `sellerClaimFunds()` - 卖家领取拍卖所得
- **买家领取 NFT**: `highestBidderClaimNFT()` - 最高出价者领取 NFT
- **提取未中标资金**: 
  - `withdrawETH()` - 提取 ETH 退款
  - `withdrawERC20(address token)` - 提取 ERC20 代币退款

### 5. 查询功能
- `getAuction()` - 获取拍卖信息
- `getPendingReturns(address user)` - 获取用户待提取 ETH 金额
- `getPendingTokenReturns(address user, address token)` - 获取用户待提取 ERC20 金额

## 事件

- `AuctionStarted` - 拍卖开始事件
- `BidPlaced` - 出价事件
- `AuctionEnded` - 拍卖结束事件
- `AuctionCancelled` - 拍卖取消事件
- `FundsWithdrawn` - ETH 资金提取事件
- `TokenFundsWithdrawn` - ERC20 代币提取事件

## 安全机制

### 1. 重入攻击防护
使用 OpenZeppelin 的 `ReentrancyGuard` 防止重入攻击。

### 2. 权限控制
- 只有卖家可以取消拍卖
- 只有最高出价者可以领取 NFT
- 只有卖家可以领取拍卖资金

### 3. 资金安全
- 使用"先检查后转移"模式
- 安全的资金提取机制
- 防止重复领取

### 4. 参数验证
- NFT 合约地址验证
- 起拍价格验证
- 持续时间验证（最长30天）
- ERC20 代币地址验证

## 使用示例

### 部署和测试
```bash
# 部署合约
npx hardhat run scripts/deploy-single-auction.ts

# 运行演示
npx hardhat run scripts/demo-single-auction.ts

# 运行测试
npx hardhat test test/SingleNFTAuction.ts
```

### 典型使用流程
1. 卖家部署合约
2. 卖家开始拍卖（转移 NFT 到合约）
3. 买家出价（ETH 或 ERC20）
4. 拍卖结束（自动或手动）
5. 卖家领取资金
6. 最高出价者领取 NFT
7. 未中标者提取退款

## 与 NFTAuction 的区别

| 特性 | SingleNFTAuction | NFTAuction |
|------|------------------|------------|
| 拍卖数量 | 单个 | 多个 |
| 拍卖 ID | 无 | 有 |
| 合约复杂度 | 较低 | 较高 |
| 使用场景 | 专用拍卖 | 通用拍卖平台 |
| 部署方式 | 每次拍卖部署新合约 | 工厂模式 |

## 优势

1. **简化管理**: 无需管理拍卖 ID，每个合约只处理一个拍卖
2. **降低复杂度**: 减少状态变量和映射，提高可读性
3. **独立部署**: 每个拍卖独立部署，互不影响
4. **易于集成**: 简单的接口，易于与其他系统集成

## 注意事项

1. 合约部署后只能进行一次拍卖
2. 拍卖结束后合约无法重复使用
3. 建议为每个 NFT 拍卖部署新的合约实例
4. 确保在开始拍卖前正确授权 NFT 给合约

## 许可证

MIT License
