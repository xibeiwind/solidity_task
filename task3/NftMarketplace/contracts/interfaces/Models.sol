// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

/**
 * @dev 支付币种类型枚举
 * @notice 定义拍卖支持的支付方式
 * @dev 支持两种支付方式：ETH（以太坊原生代币）和ERC20（标准代币）
 * @dev 使用枚举类型确保类型安全，防止无效的支付方式
 */
enum PaymentToken {
    ETH, // 以太坊原生代币，使用msg.value进行支付
    ERC20 // ERC20标准代币，使用transferFrom进行支付
}

/**
 * @dev 拍卖状态枚举
 * @notice 定义拍卖的生命周期状态
 * @dev 状态机：NotStarted -> Active -> Ended/Cancelled
 * @dev 每个状态对应不同的操作权限和业务逻辑
 */
enum AuctionStatus {
    NotStarted, // 拍卖未开始，可以调用startAuction开始拍卖
    Active, // 拍卖进行中，可以出价，不能取消（除非无人出价）
    Ended, // 拍卖已结束，可以领取NFT和资金
    Cancelled // 拍卖已取消，NFT退回给卖家，资金退回给出价者
}

/**
 * @dev 拍卖信息结构体
 * @notice 存储拍卖的所有相关信息
 * @dev 优化存储布局，将布尔值和枚举打包到同一个存储槽
 * @dev 使用10个存储槽存储完整的拍卖信息
 * @dev 字段按照存储优化原则排列，减少gas消耗
 */
struct AuctionInfo {
    address seller; // 卖家地址，NFT的所有者 (slot 0)
    address nftContract; // NFT合约地址 (slot 1)
    uint256 tokenId; // NFT token ID (slot 2)
    uint256 startingPrice; // 起拍价格，必须大于0 (slot 3)
    uint256 reservePrice; // 保留价格，0表示无保留价 (slot 4)
    uint256 endTime; // 拍卖结束时间戳（秒），基于block.timestamp计算 (slot 5)
    address highestBidder; // 当前最高出价者地址，address(0)表示无人出价 (slot 6)
    uint256 highestBid; // 当前最高出价金额，必须大于等于起拍价格 (slot 7)
    address erc20Token; // ERC20代币合约地址（如果使用ERC20支付）(slot 8)
    // 打包字段 (slot 9)
    PaymentToken paymentToken; // 支付币种类型 (占用 1 字节)
    AuctionStatus status; // 当前拍卖状态 (占用 1 字节)
    bool sellerClaimed; // 卖家是否已领取拍卖所得资金 (占用 1 字节)
    bool highestBidderClaimed; // 最高出价者是否已领取NFT (占用 1 字节)
}
