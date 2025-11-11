# Solidity 智能合约项目

这是一个包含多个智能合约的 Solidity 项目，展示了不同类型的区块链应用场景。

## 项目概述

本项目包含三个主要的智能合约：
- **MyERC20**: 自定义 ERC20 代币合约
- **MyNFT**: 极简 NFT 合约
- **BeggingContract**: 一个简单的捐赠合约

## 合约说明

### 1. MyERC20 (ERC20 代币合约)

**功能描述**：
- 实现完整的 ERC20 代币标准
- 支持代币转账、授权和委托转账
- 合约所有者可以铸造新代币

**主要函数**：
- `transfer(address to, uint256 value)` - 代币转账
- `approve(address spender, uint256 value)` - 授权额度
- `transferFrom(address from, address to, uint256 value)` - 委托转账
- `mint(address to, uint256 amount)` - 仅所有者可调用，铸造新代币

**技术特点**：
- 完全兼容 ERC20 标准
- 实现了余额映射和授权映射
- 包含铸造功能用于代币增发

### 2. MyNFT (NFT 合约)

**功能描述**：
- 实现 ERC721 NFT 标准
- 支持元数据存储（使用 ERC721URIStorage）
- 合约所有者可以铸造新的 NFT

**主要函数**：
- `mintNFT(address to, string calldata metadata)` - 仅所有者可调用，铸造 NFT
- 自动继承 ERC721 的所有标准函数

**技术特点**：
- 继承 ERC721URIStorage 用于链上元数据存储
- 继承 Ownable 进行权限管理
- 支持 IPFS 等去中心化存储的元数据 URI

### 3. BeggingContract (捐赠合约)

**功能描述**：
- 允许用户向合约捐赠 ETH
- 只有合约所有者可以提取资金
- 可以查询每个地址的捐赠总额

**主要函数**：
- `donate()` - 向合约捐赠 ETH
- `withdraw()` - 仅所有者可调用，提取合约余额
- `getDonation(address donor)` - 查询指定地址的捐赠总额

**技术特点**：
- 继承 OpenZeppelin 的 Ownable 合约
- 使用 mapping 记录捐赠记录
- 实现了安全的资金管理
- 测试网部署地址 0xb8571814940aa984d6DC21040dEfe914f3eBA76C
## 项目配置

### 开发环境
- **Solidity 版本**: 0.8.20
- **框架**: Hardhat (根据 artifacts 目录推断)
- **依赖**: OpenZeppelin Contracts

### 合约依赖
- `@openzeppelin/contracts/access/Ownable.sol`
- `@openzeppelin/contracts/token/ERC20/IERC20.sol`
- `@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol`


## 安全注意事项

- BeggingContract 的资金提取仅限于合约所有者
- MyERC20 的铸造功能仅限于合约所有者
- MyNFT 的铸造功能仅限于合约所有者
- 所有合约都使用 Solidity 0.8.20，具有内置的安全特性

## 许可证

MIT License
