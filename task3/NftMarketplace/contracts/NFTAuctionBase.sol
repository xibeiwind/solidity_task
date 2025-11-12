// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol"; // ERC721接收器接口

abstract contract NFTAuctionBase is IERC721Receiver {
    /**
     * @dev 支付币种类型枚举
     * @notice 定义拍卖支持的支付方式
     */
    enum PaymentToken {
        ETH, // 以太坊原生代币
        ERC20 // ERC20标准代币
    }

    /**
     * @dev 拍卖状态枚举
     * @notice 定义拍卖的生命周期状态
     */
    enum AuctionStatus {
        NotStarted, // 拍卖未开始
        Active, // 拍卖进行中，可以出价
        Ended, // 拍卖已结束，可以领取NFT和资金
        Cancelled // 拍卖已取消，可以退款
    }

    /**
     * @dev 拍卖信息结构体
     * @notice 存储拍卖的所有相关信息
     * @dev 优化存储布局，将布尔值和枚举打包到同一个存储槽
     */
    struct AuctionInfo {
        address seller; // 卖家地址，NFT的所有者 (slot 0)
        address nftContract; // NFT合约地址 (slot 1)
        uint256 tokenId; // NFT token ID (slot 2)
        uint256 startingPrice; // 起拍价格 (slot 3)
        uint256 reservePrice; // 保留价格 (slot 4)
        uint256 endTime; // 拍卖结束时间戳（秒）(slot 5)
        address highestBidder; // 当前最高出价者地址 (slot 6)
        uint256 highestBid; // 当前最高出价金额 (slot 7)
        address erc20Token; // ERC20代币合约地址（如果使用ERC20支付）(slot 8)
        // 打包字段 (slot 9)
        PaymentToken paymentToken; // 支付币种类型 (占用 1 字节)
        AuctionStatus status; // 当前拍卖状态 (占用 1 字节)
        bool sellerClaimed; // 卖家是否已领取拍卖所得资金 (占用 1 字节)
        bool highestBidderClaimed; // 最高出价者是否已领取NFT (占用 1 字节)
    }

    // 事件定义
    /**
     * @dev 拍卖开始事件
     * @param seller 卖家地址
     * @param nftContract NFT合约地址
     * @param tokenId NFT token ID
     * @param startingPrice 起拍价格
     * @param reservePrice 保留价格
     * @param endTime 拍卖结束时间
     * @param paymentToken 支付币种类型
     * @param erc20Token ERC20代币地址
     */
    event AuctionStarted(
        address indexed seller,
        address nftContract,
        uint256 tokenId,
        uint256 startingPrice,
        uint256 reservePrice,
        uint256 endTime,
        PaymentToken paymentToken,
        address erc20Token
    );

    /**
     * @dev 出价事件
     * @param bidder 出价者地址
     * @param amount 出价金额
     */
    event BidPlaced(address bidder, uint256 amount);

    /**
     * @dev 拍卖结束事件
     * @param winner 获胜者地址
     * @param winningBid 获胜出价金额
     */
    event AuctionEnded(address winner, uint256 winningBid);

    /**
     * @dev 拍卖取消事件
     */
    event AuctionCancelled();

    /**
     * @dev ETH资金提取事件
     * @param user 用户地址
     * @param amount 提取金额
     */
    event FundsWithdrawn(address indexed user, uint256 amount);

    /**
     * @dev ERC20代币资金提取事件
     * @param user 用户地址
     * @param token 代币地址
     * @param amount 提取金额
     */
    event TokenFundsWithdrawn(
        address indexed user,
        address token,
        uint256 amount
    );

    /**
     * @dev ERC721接收函数
     * @notice 实现IERC721Receiver接口，用于安全接收NFT
     * @param operator 操作者地址（调用transferFrom的地址）
     * @param from 发送者地址
     * @param tokenId NFT token ID
     * @param data 附加数据
     * @return 函数选择器，表示成功接收
     * @dev 此函数必须返回IERC721Receiver.onERC721Received.selector，否则NFT转移会失败
     */
    function onERC721Received(
        address operator,
        address from,
        uint256 tokenId,
        bytes calldata data
    ) external pure returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }
}
