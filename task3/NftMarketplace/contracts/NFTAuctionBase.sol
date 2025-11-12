// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol"; // ERC721接收器接口

/**
 * @title NFTAuctionBase
 * @dev NFT拍卖基础合约，定义拍卖相关的数据结构、事件和接口
 * @notice 提供NFT拍卖系统的基础框架，包括枚举定义、结构体定义和事件定义
 * @dev 继承IERC721Receiver接口，支持安全接收NFT转移
 * @dev 抽象合约，需要具体实现类继承并实现具体拍卖逻辑
 * @dev 包含拍卖状态管理、支付方式定义、事件系统等核心组件
 */
abstract contract NFTAuctionBase is IERC721Receiver {
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

    // 事件定义

    /**
     * @dev 价格预言机更新事件
     * @param priceOracle 新的价格预言机地址
     */
    event PriceOracleUpdated(address priceOracle);
    
    /**
     * @dev 拍卖开始事件
     * @notice 当新的拍卖开始时触发
     * @param seller 卖家地址（索引字段，便于前端过滤）
     * @param nftContract NFT合约地址
     * @param tokenId NFT token ID
     * @param startingPrice 起拍价格（wei）
     * @param reservePrice 保留价格（wei），0表示无保留价
     * @param endTime 拍卖结束时间（Unix时间戳）
     * @param paymentToken 支付币种类型
     * @param erc20Token ERC20代币地址，如果使用ETH支付则为address(0)
     * @dev 此事件包含拍卖的所有初始参数，便于前端展示和链下索引
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
     * @notice 当用户成功出价时触发
     * @param bidder 出价者地址
     * @param amount 出价金额（wei或代币单位）
     * @param amountInUSD 出价金额的美元价值（基于预言机价格）
     * @dev 此事件记录每次成功的出价，包括原始金额和美元价值
     * @dev amountInUSD用于前端展示和数据分析
     */
    event BidPlaced(address bidder, uint256 amount, uint256 amountInUSD);

    /**
     * @dev 拍卖结束事件
     * @notice 当拍卖结束时触发
     * @param winner 获胜者地址，address(0)表示拍卖失败
     * @param winningBid 获胜出价金额，0表示拍卖失败
     * @dev 此事件表示拍卖的最终结果，包括获胜者和获胜出价
     * @dev 如果winner为address(0)，表示拍卖未达到保留价格或无有效出价
     */
    event AuctionEnded(address winner, uint256 winningBid);

    /**
     * @dev 拍卖取消事件
     * @notice 当卖家取消拍卖时触发
     * @dev 此事件表示拍卖被卖家主动取消
     * @dev 只有在无人出价时才能取消拍卖
     */
    event AuctionCancelled();

    /**
     * @dev ETH资金提取事件
     * @notice 当用户提取未中标的ETH资金时触发
     * @param user 用户地址（索引字段，便于前端过滤）
     * @param amount 提取金额（wei）
     * @dev 此事件记录用户成功提取的ETH资金
     * @dev 通常发生在用户出价被超越后提取退款
     */
    event FundsWithdrawn(address indexed user, uint256 amount);

    /**
     * @dev ERC20代币资金提取事件
     * @notice 当用户提取未中标的ERC20代币资金时触发
     * @param user 用户地址（索引字段，便于前端过滤）
     * @param token 代币合约地址
     * @param amount 提取金额（代币单位）
     * @dev 此事件记录用户成功提取的ERC20代币资金
     * @dev 通常发生在用户出价被超越后提取退款
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
     * @param from 发送者地址（NFT原所有者）
     * @param tokenId NFT token ID
     * @param data 附加数据（通常为空）
     * @return 函数选择器，表示成功接收
     * @dev 此函数必须返回IERC721Receiver.onERC721Received.selector，否则NFT转移会失败
     * @dev 使用pure修饰符，因为此函数不读取或修改合约状态
     * @dev 此函数允许合约安全地接收NFT，符合ERC721标准要求
     * @dev 当使用safeTransferFrom转移NFT到合约时，此函数会被自动调用
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
