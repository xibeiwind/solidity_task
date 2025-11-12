// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

// OpenZeppelin 合约导入
import "@openzeppelin/contracts/token/ERC20/IERC20.sol"; // ERC20代币接口
import "@openzeppelin/contracts/token/ERC721/IERC721.sol"; // ERC721 NFT接口
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol"; // ERC721接收器接口
import "@openzeppelin/contracts/access/Ownable.sol"; // 所有权管理
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol"; // 重入攻击防护

// 价格预言机接口
import "./interfaces/IPriceOracle.sol";

/**
 * @title NFTAuction
 * @dev NFT拍卖合约，支持ETH和ERC20代币支付
 * @notice 该合约实现了NFT拍卖功能，包括创建拍卖、出价、结束拍卖、取消拍卖等操作
 * @dev 继承ReentrancyGuard防止重入攻击，IERC721Receiver用于接收NFT，Ownable用于权限管理
 */
contract NFTAuction is ReentrancyGuard, IERC721Receiver, Ownable {
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
        Active, // 拍卖进行中，可以出价
        Ended, // 拍卖已结束，可以领取NFT和资金
        Cancelled // 拍卖已取消，可以退款
    }

    /**
     * @dev 拍卖信息结构体
     * @notice 存储单个拍卖的所有相关信息
     * @dev 优化存储布局，将布尔值和枚举打包到同一个存储槽
     */
    struct Auction {
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

    /**
     * @dev 创建拍卖参数结构体
     * @notice 用于优化createAuction函数的参数传递
     */
    struct CreateAuctionParams {
        address nftContract;
        uint256 tokenId;
        uint256 startingPrice;
        uint256 reservePrice;
        uint256 duration;
        PaymentToken paymentToken;
        address erc20Token;
    }

    /**
     * @dev 拍卖ID计数器
     * @notice 用于生成唯一的拍卖ID，每次创建拍卖时递增
     */
    uint256 private _auctionIdCounter;

    /**
     * @dev 价格预言机合约地址
     * @notice 用于查询ETH和ERC20代币的美元价格
     */
    IPriceOracle public priceOracle;

    // 存储映射
    /**
     * @dev 拍卖ID到拍卖信息的映射
     * @notice 存储所有创建的拍卖信息
     */
    mapping(uint256 => Auction) public auctions;

    /**
     * @dev 拍卖ID到用户地址到出价金额的映射
     * @notice 记录每个用户在每次拍卖中的出价金额
     */
    mapping(uint256 => mapping(address => uint256)) public bids;

    /**
     * @dev 用户地址到可领取ETH金额的映射
     * @notice 存储用户可提取的ETH资金（如出价失败退款）
     */
    mapping(address => uint256) public pendingReturns;

    /**
     * @dev 用户地址到ERC20代币地址到可领取金额的映射
     * @notice 存储用户可提取的ERC20代币资金
     */
    mapping(address => mapping(address => uint256)) public pendingTokenReturns;

    // 事件定义
    /**
     * @dev 拍卖创建事件
     * @param auctionId 拍卖ID
     * @param seller 卖家地址
     * @param nftContract NFT合约地址
     * @param tokenId NFT token ID
     * @param startingPrice 起拍价格
     * @param reservePrice 保留价格
     * @param endTime 拍卖结束时间
     * @param paymentToken 支付币种类型
     * @param erc20Token ERC20代币地址
     * @dev 优化：只对最重要的字段建立索引，减少gas成本
     */
    event AuctionCreated(
        uint256 indexed auctionId,
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
     * @param auctionId 拍卖ID
     * @param bidder 出价者地址
     * @param amount 出价金额
     * @param amountInUSD 出价金额的美元价值（基于预言机价格）
     */
    event BidPlaced(
        uint256 indexed auctionId,
        address bidder,
        uint256 amount,
        uint256 amountInUSD
    );

    /**
     * @dev 拍卖结束事件
     * @param auctionId 拍卖ID
     * @param winner 获胜者地址
     * @param winningBid 获胜出价金额
     */
    event AuctionEnded(
        uint256 indexed auctionId,
        address winner,
        uint256 winningBid
    );

    /**
     * @dev 拍卖取消事件
     * @param auctionId 拍卖ID
     */
    event AuctionCancelled(uint256 indexed auctionId);

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
     * @dev 构造函数
     * @notice 初始化合约所有者
     */
    constructor() Ownable(msg.sender) {
        // 构造函数初始化
        // 当前实现为空，可根据需要添加初始化逻辑
    }

    /**
     * @dev 设置价格预言机
     * @notice 设置用于查询ETH和ERC20代币美元价格的价格预言机合约
     * @param oracleAddress 价格预言机合约地址
     * @dev 只有合约所有者可以调用此函数
     */
    function setPriceOracle(address oracleAddress) external onlyOwner {
        require(oracleAddress != address(0), "Invalid oracle address");
        priceOracle = IPriceOracle(oracleAddress);
    }

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
    ) external pure override returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }

    /**
     * @dev 拍卖存在性检查修饰符
     * @param auctionId 拍卖ID
     * @notice 检查指定拍卖是否存在
     * @dev 通过检查卖家地址是否为0地址来判断拍卖是否存在
     */
    modifier auctionExists(uint256 auctionId) {
        require(
            auctions[auctionId].seller != address(0),
            "Auction does not exist"
        );
        _;
    }

    /**
     * @dev 拍卖活跃状态检查修饰符
     * @param auctionId 拍卖ID
     * @notice 检查拍卖是否处于活跃状态且未结束
     * @dev 检查拍卖状态为Active且当前时间小于结束时间
     */
    modifier auctionIsActive(uint256 auctionId) {
        require(
            auctions[auctionId].status == AuctionStatus.Active,
            "Auction not active"
        );
        require(
            block.timestamp < auctions[auctionId].endTime,
            "Auction has ended"
        );
        _;
    }

    /**
     * @dev 拍卖结束状态检查修饰符
     * @param auctionId 拍卖ID
     * @notice 检查拍卖是否已结束
     * @dev 检查当前时间是否超过结束时间或拍卖状态不是Active
     */
    modifier auctionEnded(uint256 auctionId) {
        require(
            block.timestamp >= auctions[auctionId].endTime ||
                auctions[auctionId].status != AuctionStatus.Active,
            "Auction not ended"
        );
        _;
    }

    /**
     * @dev 创建拍卖函数
     * @notice 创建一个新的NFT拍卖
     * @param nftContract NFT合约地址
     * @param tokenId NFT token ID
     * @param startingPrice 起拍价格（wei）
     * @param reservePrice 保留价格（wei），0表示无保留价
     * @param duration 拍卖持续时间（秒）
     * @param paymentToken 支付币种类型
     * @param erc20Token ERC20代币地址（如果使用ERC20支付）
     * @return auctionId 新创建的拍卖ID
     * @dev 此函数会将NFT从调用者转移到合约，并设置拍卖参数
     * @dev 拍卖持续时间限制在30天内，防止过长的拍卖
     */
    function createAuction(
        address nftContract,
        uint256 tokenId,
        uint256 startingPrice,
        uint256 reservePrice,
        uint256 duration,
        PaymentToken paymentToken,
        address erc20Token
    ) external returns (uint256) {
        CreateAuctionParams memory params = CreateAuctionParams({
            nftContract: nftContract,
            tokenId: tokenId,
            startingPrice: startingPrice,
            reservePrice: reservePrice,
            duration: duration,
            paymentToken: paymentToken,
            erc20Token: erc20Token
        });
        return _createAuction(params);
    }

    /**
     * @dev 优化的创建拍卖函数（使用参数结构体）
     * @notice 创建一个新的NFT拍卖，使用参数结构体减少calldata成本
     * @param params 创建拍卖参数结构体
     * @return auctionId 新创建的拍卖ID
     * @dev 内部实现，减少重复的参数验证和逻辑
     */
    function createAuctionOptimized(
        CreateAuctionParams calldata params
    ) external returns (uint256) {
        return _createAuction(params);
    }

    /**
     * @dev 内部创建拍卖函数
     * @notice 创建拍卖的内部实现，减少重复代码
     * @param params 创建拍卖参数结构体
     * @return auctionId 新创建的拍卖ID
     * @dev 内部函数，包含所有创建拍卖的核心逻辑
     */
    function _createAuction(
        CreateAuctionParams memory params
    ) internal returns (uint256) {
        // 参数验证
        require(params.nftContract != address(0), "Invalid NFT contract");
        require(params.startingPrice > 0, "Starting price must be > 0");
        require(params.duration > 0 && params.duration <= 30 days, "Invalid duration");

        // 如果使用ERC20支付，验证代币地址
        if (params.paymentToken == PaymentToken.ERC20) {
            require(params.erc20Token != address(0), "Invalid ERC20 token");
        }

        // 生成新的拍卖ID
        uint256 auctionId = _auctionIdCounter++;

        // 转移NFT到合约进行托管
        IERC721(params.nftContract).safeTransferFrom(
            msg.sender,
            address(this),
            params.tokenId
        );

        // 创建拍卖信息
        auctions[auctionId] = Auction({
            seller: msg.sender,
            nftContract: params.nftContract,
            tokenId: params.tokenId,
            startingPrice: params.startingPrice,
            reservePrice: params.reservePrice,
            endTime: block.timestamp + params.duration,
            highestBidder: address(0),
            highestBid: 0,
            paymentToken: params.paymentToken,
            erc20Token: params.erc20Token,
            status: AuctionStatus.Active,
            sellerClaimed: false,
            highestBidderClaimed: false
        });

        // 触发拍卖创建事件
        emit AuctionCreated(
            auctionId,
            msg.sender,
            params.nftContract,
            params.tokenId,
            params.startingPrice,
            params.reservePrice,
            block.timestamp + params.duration,
            params.paymentToken,
            params.erc20Token
        );

        return auctionId;
    }

    /**
     * @dev ETH出价函数
     * @notice 使用ETH参与拍卖出价
     * @param auctionId 拍卖ID
     * @dev 此函数需要支付ETH，出价必须高于当前最高出价且不低于起拍价格
     * @dev 如果之前有出价者，其资金会被记录到待退款映射中
     * @dev 使用nonReentrant修饰符防止重入攻击
     * @dev 使用缓存优化减少存储读取
     */
    function placeBidETH(
        uint256 auctionId
    )
        external
        payable
        nonReentrant
        auctionExists(auctionId)
        auctionIsActive(auctionId)
    {
        Auction storage auction = auctions[auctionId];
        
        // 缓存频繁访问的变量到内存
        uint256 currentHighestBid = auction.highestBid;
        address currentHighestBidder = auction.highestBidder;
        uint256 currentStartingPrice = auction.startingPrice;
        
        require(
            auction.paymentToken == PaymentToken.ETH,
            "Payment must be in ETH"
        );
        require(
            msg.value > currentHighestBid,
            "Bid must be higher than current bid"
        );
        require(msg.value >= currentStartingPrice, "Bid below starting price");

        // 如果之前有出价，退还给之前的最高出价者
        if (currentHighestBidder != address(0)) {
            pendingReturns[currentHighestBidder] += currentHighestBid;
        }

        // 更新最高出价
        auction.highestBidder = msg.sender;
        auction.highestBid = msg.value;

        // 计算美元价值
        uint256 amountInUSD = _calculateUSDValue(msg.value, PaymentToken.ETH, auction.erc20Token);

        emit BidPlaced(auctionId, msg.sender, msg.value, amountInUSD);
    }

    /**
     * @dev ERC20代币出价函数
     * @notice 使用ERC20代币参与拍卖出价
     * @param auctionId 拍卖ID
     * @param amount 出价金额（代币单位）
     * @dev 此函数需要用户预先授权合约使用其代币
     * @dev 出价必须高于当前最高出价且不低于起拍价格
     * @dev 检查用户余额和授权额度是否足够
     * @dev 如果之前有出价者，其代币会被记录到待退款映射中
     * @dev 使用缓存优化减少存储读取
     */
    function placeBidERC20(
        uint256 auctionId,
        uint256 amount
    ) external nonReentrant auctionExists(auctionId) auctionIsActive(auctionId) {
        Auction storage auction = auctions[auctionId];
        
        // 缓存频繁访问的变量到内存
        uint256 currentHighestBid = auction.highestBid;
        address currentHighestBidder = auction.highestBidder;
        uint256 currentStartingPrice = auction.startingPrice;
        address currentERC20Token = auction.erc20Token;
        
        require(
            auction.paymentToken == PaymentToken.ERC20,
            "Payment must be in ERC20"
        );
        require(
            amount > currentHighestBid,
            "Bid must be higher than current bid"
        );
        require(amount >= currentStartingPrice, "Bid below starting price");

        // 检查用户余额和授权
        IERC20 token = IERC20(currentERC20Token);

        require(
            token.allowance(msg.sender, address(this)) >= amount,
            "Insufficient allowance"
        );
        require(
            token.balanceOf(msg.sender) >= amount,
            "Insufficient token balance"
        );
        // 如果之前有出价，退还给之前的最高出价者
        if (currentHighestBidder != address(0)) {
            pendingTokenReturns[currentHighestBidder][
                currentERC20Token
            ] += currentHighestBid;
        }

        // 从出价者转移代币到合约
        require(
            token.transferFrom(msg.sender, address(this), amount),
            "Token transfer failed"
        );

        // 更新最高出价
        auction.highestBidder = msg.sender;
        auction.highestBid = amount;

        // 计算美元价值
        uint256 amountInUSD = _calculateUSDValue(amount, PaymentToken.ERC20, auction.erc20Token);

        emit BidPlaced(auctionId, msg.sender, amount, amountInUSD);
    }

    /**
     * @dev 内部函数：计算美元价值
     * @notice 根据支付币种类型和金额计算美元价值
     * @param amount 原始金额
     * @param paymentToken 支付币种类型
     * @param erc20Token ERC20代币地址（如果使用ERC20支付）
     * @return 美元价值（8位小数精度）
     * @dev 如果价格预言机未设置或价格查询失败，返回0
     */
    function _calculateUSDValue(
        uint256 amount,
        PaymentToken paymentToken,
        address erc20Token
    ) internal view returns (uint256) {
        // 如果价格预言机未设置，返回0
        if (address(priceOracle) == address(0)) {
            return 0;
        }

        try priceOracle.getETHPrice() returns (uint256 ethPrice, uint256) {
            if (paymentToken == PaymentToken.ETH) {
                // ETH美元价值计算：amount * ethPrice / 1e18
                // ethPrice是8位小数，amount是18位小数，结果应该是8位小数
                return (amount * ethPrice) / 1e18;
            } else if (paymentToken == PaymentToken.ERC20) {
                // ERC20代币美元价值计算
                try priceOracle.getTokenPrice(erc20Token) returns (uint256 tokenPrice, uint256) {
                    // tokenPrice是8位小数，amount是代币单位，结果应该是8位小数
                    // 假设代币有18位小数
                    return (amount * tokenPrice) / 1e18;
                } catch {
                    return 0;
                }
            }
        } catch {
            return 0;
        }

        return 0;
    }

    /**
     * @dev 结束拍卖函数
     * @notice 手动结束拍卖，触发拍卖结束事件
     * @param auctionId 拍卖ID
     * @dev 此函数可以由任何人调用，但拍卖必须已经结束
     * @dev 检查拍卖是否达到保留价格，并触发相应的事件
     * @dev 如果达到保留价格且有出价，宣布获胜者；否则宣布拍卖失败
     */
    function endAuction(
        uint256 auctionId
    ) external nonReentrant auctionExists(auctionId) auctionEnded(auctionId) {
        Auction storage auction = auctions[auctionId];
        require(auction.status == AuctionStatus.Active, "Auction not active");

        auction.status = AuctionStatus.Ended;

        // 检查是否达到保留价格
        bool hasMetReserve = auction.reservePrice == 0 ||
            auction.highestBid >= auction.reservePrice;

        if (auction.highestBidder != address(0) && hasMetReserve) {
            // 有有效出价且达到保留价格
            emit AuctionEnded(
                auctionId,
                auction.highestBidder,
                auction.highestBid
            );
        } else {
            // 没有达到保留价格或无出价
            emit AuctionEnded(auctionId, address(0), 0);
        }
    }

    /**
     * @dev 卖家领取资金函数
     * @notice 卖家在拍卖结束后领取拍卖所得资金
     * @param auctionId 拍卖ID
     * @dev 只有卖家可以调用此函数
     * @dev 如果拍卖达到保留价格且有出价，卖家获得资金；否则NFT退回给卖家
     * @dev 支持ETH和ERC20两种支付方式
     */
    function sellerClaimFunds(
        uint256 auctionId
    ) external nonReentrant auctionExists(auctionId) {
        Auction storage auction = auctions[auctionId];
        require(msg.sender == auction.seller, "Only seller can claim");
        require(!auction.sellerClaimed, "Already claimed");
        require(auction.status == AuctionStatus.Ended, "Auction not ended");

        auction.sellerClaimed = true;

        bool hasMetReserve = auction.reservePrice == 0 ||
            auction.highestBid >= auction.reservePrice;

        if (auction.highestBidder != address(0) && hasMetReserve) {
            if (auction.paymentToken == PaymentToken.ETH) {
                // 转移ETH给卖家
                (bool success, ) = auction.seller.call{
                    value: auction.highestBid
                }("");
                require(success, "ETH transfer failed");
            } else {
                // 转移ERC20代币给卖家
                IERC20 token = IERC20(auction.erc20Token);
                require(
                    token.transfer(auction.seller, auction.highestBid),
                    "Token transfer failed"
                );
            }
        } else {
            // 没有达到保留价格，NFT退回给卖家
            IERC721(auction.nftContract).safeTransferFrom(
                address(this),
                auction.seller,
                auction.tokenId
            );
        }
    }

    /**
     * @dev 最高出价者领取NFT函数
     * @notice 最高出价者在拍卖结束后领取NFT
     * @param auctionId 拍卖ID
     * @dev 只有最高出价者可以调用此函数
     * @dev 只有在拍卖达到保留价格时才能领取NFT
     * @dev 如果没有达到保留价格，NFT会退回给卖家
     */
    function highestBidderClaimNFT(
        uint256 auctionId
    ) external nonReentrant auctionExists(auctionId) {
        Auction storage auction = auctions[auctionId];
        require(
            msg.sender == auction.highestBidder,
            "Only highest bidder can claim"
        );
        require(!auction.highestBidderClaimed, "Already claimed");
        require(auction.status == AuctionStatus.Ended, "Auction not ended");

        auction.highestBidderClaimed = true;

        bool hasMetReserve = auction.reservePrice == 0 ||
            auction.highestBid >= auction.reservePrice;

        if (hasMetReserve) {
            // 转移NFT给最高出价者
            IERC721(auction.nftContract).safeTransferFrom(
                address(this),
                auction.highestBidder,
                auction.tokenId
            );
        }
        // 如果没有达到保留价格，NFT已经退回给卖家
    }

    /**
     * @dev 提取未中标ETH资金函数
     * @notice 用户提取在拍卖中未中标的ETH资金
     * @dev 使用"先检查后转移"模式防止重入攻击
     * @dev 提取前会检查用户是否有待提取的ETH资金
     * @dev 提取后会将用户的待提取金额清零
     */
    function withdrawETH() external nonReentrant {
        uint256 amount = pendingReturns[msg.sender];
        require(amount > 0, "No pending returns");

        pendingReturns[msg.sender] = 0;

        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "ETH transfer failed");

        emit FundsWithdrawn(msg.sender, amount);
    }

    /**
     * @dev 提取未中标ERC20资金函数
     * @notice 用户提取在拍卖中未中标的ERC20代币资金
     * @param token ERC20代币合约地址
     * @dev 使用"先检查后转移"模式防止重入攻击
     * @dev 提取前会检查用户是否有待提取的代币资金
     * @dev 提取后会将用户的待提取金额清零
     */
    function withdrawERC20(address token) external nonReentrant {
        uint256 amount = pendingTokenReturns[msg.sender][token];
        require(amount > 0, "No pending returns");

        pendingTokenReturns[msg.sender][token] = 0;

        require(
            IERC20(token).transfer(msg.sender, amount),
            "Token transfer failed"
        );

        emit TokenFundsWithdrawn(msg.sender, token, amount);
    }

    /**
     * @dev 取消拍卖函数
     * @notice 卖家取消拍卖（仅在无人出价时可用）
     * @param auctionId 拍卖ID
     * @dev 只有卖家可以取消拍卖，且必须在拍卖活跃期间
     * @dev 如果已经有人出价，则无法取消拍卖
     * @dev 取消后NFT会退回给卖家
     */
    function cancelAuction(
        uint256 auctionId
    ) external nonReentrant auctionExists(auctionId) auctionIsActive(auctionId) {
        Auction storage auction = auctions[auctionId];
        require(msg.sender == auction.seller, "Only seller can cancel");
        require(auction.highestBidder == address(0), "Cannot cancel with bids");

        auction.status = AuctionStatus.Cancelled;

        // 退回NFT给卖家
        IERC721(auction.nftContract).safeTransferFrom(
            address(this),
            auction.seller,
            auction.tokenId
        );

        emit AuctionCancelled(auctionId);
    }

    /**
     * @dev 获取拍卖信息函数
     * @notice 查询指定拍卖的详细信息
     * @param auctionId 拍卖ID
     * @return 拍卖信息结构体
     * @dev 这是一个只读函数，不会修改合约状态
     */
    function getAuction(
        uint256 auctionId
    ) external view returns (Auction memory) {
        return auctions[auctionId];
    }

    /**
     * @dev 获取用户未领取ETH资金函数
     * @notice 查询用户可提取的ETH资金余额
     * @param user 用户地址
     * @return ethAmount 可提取的ETH金额
     * @dev 这是一个只读函数，不会修改合约状态
     */
    function getPendingReturns(
        address user
    ) external view returns (uint256 ethAmount) {
        return pendingReturns[user];
    }

    /**
     * @dev 获取用户未领取ERC20资金函数
     * @notice 查询用户可提取的ERC20代币资金余额
     * @param user 用户地址
     * @param token ERC20代币合约地址
     * @return tokenAmount 可提取的代币金额
     * @dev 这是一个只读函数，不会修改合约状态
     */
    function getPendingTokenReturns(
        address user,
        address token
    ) external view returns (uint256 tokenAmount) {
        return pendingTokenReturns[user][token];
    }

    /**
     * @dev 紧急提款函数
     * @notice 管理员处理异常情况的紧急提款功能
     * @param auctionId 拍卖ID
     * @dev 只有合约所有者可以调用此函数
     * @dev 只能在拍卖结束30天后使用，防止过早干预
     * @dev 如果卖家未领取资金，将资金转给卖家
     * @dev 如果最高出价者未领取NFT，将NFT转给最高出价者
     * @dev 这是一个安全机制，用于处理用户忘记领取的情况
     */
    function emergencyWithdraw(uint256 auctionId) external onlyOwner {
        Auction storage auction = auctions[auctionId];
        require(auction.seller != address(0), "Auction does not exist");
        require(
            block.timestamp > auction.endTime + 30 days,
            "Too early for emergency withdrawal"
        );

        if (!auction.sellerClaimed && auction.highestBid > 0) {
            // 将资金转给卖家
            if (auction.paymentToken == PaymentToken.ETH) {
                (bool success, ) = auction.seller.call{
                    value: auction.highestBid
                }("");
                require(success, "ETH transfer failed");
            } else {
                IERC20 token = IERC20(auction.erc20Token);
                require(
                    token.transfer(auction.seller, auction.highestBid),
                    "Token transfer failed"
                );
            }
            auction.sellerClaimed = true;
        }

        if (
            !auction.highestBidderClaimed && auction.highestBidder != address(0)
        ) {
            // 将NFT转给最高出价者
            IERC721(auction.nftContract).safeTransferFrom(
                address(this),
                auction.highestBidder,
                auction.tokenId
            );
            auction.highestBidderClaimed = true;
        }
    }
}
