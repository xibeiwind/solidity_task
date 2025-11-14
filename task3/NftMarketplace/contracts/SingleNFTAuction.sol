// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts ^5.5.0
pragma solidity ^0.8.27;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol"; // ERC20代币接口
import "@openzeppelin/contracts/token/ERC721/IERC721.sol"; // ERC721 NFT接口
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol"; // 重入攻击防护
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

import "./interfaces/IPriceOracle.sol";
import "./interfaces/INFTAuction.sol";

contract SingleNFTAuction is
    INFTAuction,
    ReentrancyGuardUpgradeable,
    OwnableUpgradeable,
    UUPSUpgradeable
{
    /**
     * @dev 拍卖信息结构体
     * @notice 存储当前拍卖的所有相关信息
     * @dev 包括卖家、NFT信息、出价信息、拍卖状态等
     */
    AuctionInfo public auction;

    /**
     * @dev 价格预言机合约地址
     * @notice 用于查询ETH和ERC20代币的美元价格
     */
    IPriceOracle public priceOracle;

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

    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address initialOwner,
        address _priceOracle
    ) public initializer {
        __ReentrancyGuard_init();
        __Ownable_init(initialOwner);
        priceOracle = IPriceOracle(_priceOracle);
        // 初始化拍卖状态为未开始
        auction.status = AuctionStatus.NotStarted;
    }

    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyOwner {}

    /**
     * @dev 拍卖活跃状态检查修饰符
     * @notice 检查拍卖是否处于活跃状态且未结束
     * @dev 检查拍卖状态为Active且当前时间小于结束时间
     */
    modifier auctionIsActive() {
        require(auction.status == AuctionStatus.Active, "Auction not active");
        require(block.timestamp < auction.endTime, "Auction has ended");
        _;
    }

    /**
     * @dev 拍卖结束状态检查修饰符
     * @notice 检查拍卖是否已结束
     * @dev 检查当前时间是否超过结束时间或拍卖状态不是Active
     */
    modifier auctionEnded() {
        require(
            block.timestamp >= auction.endTime ||
                auction.status != AuctionStatus.Active,
            "Auction not ended"
        );
        _;
    }

    /**
     * @dev 设置价格预言机地址
     * @notice 更新价格预言机合约地址
     * @param _priceOracle 新的价格预言机合约地址
     * @dev 只有合约所有者可以调用此函数
     * @dev 用于在预言机合约升级或更换时更新地址
     */
    function setPriceOracle(address _priceOracle) external onlyOwner {
        require(_priceOracle != address(0), "Invalid price oracle address");
        priceOracle = IPriceOracle(_priceOracle);
        emit PriceOracleUpdated(_priceOracle);
    }

    /**
     * @dev 开始拍卖函数
     * @notice 开始一个新的NFT拍卖
     * @param nftContract NFT合约地址
     * @param tokenId NFT token ID
     * @param startingPrice 起拍价格（wei）
     * @param reservePrice 保留价格（wei），0表示无保留价
     * @param duration 拍卖持续时间（秒）
     * @param paymentToken 支付币种类型
     * @param erc20Token ERC20代币地址（如果使用ERC20支付）
     * @dev 此函数会将NFT从调用者转移到合约，并设置拍卖参数
     * @dev 拍卖持续时间限制在30天内，防止过长的拍卖
     */
    function startAuction(
        address nftContract,
        uint256 tokenId,
        uint256 startingPrice,
        uint256 reservePrice,
        uint256 duration,
        PaymentToken paymentToken,
        address erc20Token
    ) external nonReentrant {
        // 参数验证
        require(nftContract != address(0), "Invalid NFT contract");
        require(startingPrice > 0, "Starting price must be > 0");
        require(duration > 0 && duration <= 30 days, "Invalid duration");
        require(
            auction.status == AuctionStatus.NotStarted,
            "Auction already started"
        );

        // 如果使用ERC20支付，验证代币地址
        if (paymentToken == PaymentToken.ERC20) {
            require(erc20Token != address(0), "Invalid ERC20 token");
        }

        // 转移NFT到合约进行托管
        IERC721(nftContract).safeTransferFrom(
            msg.sender,
            address(this),
            tokenId
        );

        // 设置拍卖信息
        auction = AuctionInfo({
            seller: msg.sender,
            nftContract: nftContract,
            tokenId: tokenId,
            startingPrice: startingPrice,
            reservePrice: reservePrice,
            endTime: block.timestamp + duration,
            highestBidder: address(0),
            highestBid: 0,
            paymentToken: paymentToken,
            erc20Token: erc20Token,
            status: AuctionStatus.Active,
            sellerClaimed: false,
            highestBidderClaimed: false
        });

        // 触发拍卖开始事件
        emit AuctionStarted(
            msg.sender,
            nftContract,
            tokenId,
            startingPrice,
            reservePrice,
            block.timestamp + duration,
            paymentToken,
            erc20Token
        );
    }

    /**
     * @dev ETH出价函数
     * @notice 使用ETH参与拍卖出价
     * @dev 此函数需要支付ETH，出价必须高于当前最高出价且不低于起拍价格
     * @dev 如果之前有出价者，其资金会被记录到待退款映射中
     * @dev 使用nonReentrant修饰符防止重入攻击
     * @dev 使用缓存优化减少存储读取
     */
    function placeBidETH() external payable nonReentrant auctionIsActive {
        require(
            auction.paymentToken == PaymentToken.ETH,
            "Payment must be in ETH"
        );
        require(
            msg.value > auction.highestBid,
            "Bid must be higher than current bid"
        );
        require(msg.value >= auction.startingPrice, "Bid below starting price");

        // 缓存当前最高出价者
        address currentHighestBidder = auction.highestBidder;
        uint256 currentHighestBid = auction.highestBid;

        // 如果之前有出价，退还给之前的最高出价者
        if (currentHighestBidder != address(0)) {
            pendingReturns[currentHighestBidder] += currentHighestBid;
        }

        // 更新最高出价
        auction.highestBidder = msg.sender;
        auction.highestBid = msg.value;

        // 使用价格预言机计算美元价值
        uint256 amountInUSD = 0;
        if (address(priceOracle) != address(0)) {
            try priceOracle.getETHPrice() returns (uint256 ethPrice, uint256) {
                amountInUSD = (msg.value * ethPrice) / 10 ** 18;
            } catch {
                // 如果价格查询失败，继续执行但美元价值为0
            }
        }

        emit BidPlaced(msg.sender, msg.value, amountInUSD);
    }

    /**
     * @dev ERC20代币出价函数
     * @notice 使用ERC20代币参与拍卖出价
     * @param amount 出价金额（代币单位）
     * @dev 此函数需要用户预先授权合约使用其代币
     * @dev 出价必须高于当前最高出价且不低于起拍价格
     * @dev 检查用户余额和授权额度是否足够
     * @dev 如果之前有出价者，其代币会被记录到待退款映射中
     * @dev 使用缓存优化减少存储读取
     */
    function placeBidERC20(
        uint256 amount
    ) external nonReentrant auctionIsActive {
        require(
            auction.paymentToken == PaymentToken.ERC20,
            "Payment must be in ERC20"
        );
        require(
            amount > auction.highestBid,
            "Bid must be higher than current bid"
        );
        require(amount >= auction.startingPrice, "Bid below starting price");

        // 检查用户余额和授权
        IERC20 token = IERC20(auction.erc20Token);
        require(
            token.balanceOf(msg.sender) >= amount,
            "Insufficient token balance"
        );
        require(
            token.allowance(msg.sender, address(this)) >= amount,
            "Insufficient allowance"
        );

        // 缓存当前最高出价者
        address currentHighestBidder = auction.highestBidder;
        uint256 currentHighestBid = auction.highestBid;

        // 如果之前有出价，退还给之前的最高出价者
        if (currentHighestBidder != address(0)) {
            pendingTokenReturns[currentHighestBidder][
                auction.erc20Token
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

        // 使用价格预言机计算美元价值
        uint256 amountInUSD = 0;
        if (address(priceOracle) != address(0)) {
            try priceOracle.getTokenPrice(auction.erc20Token) returns (
                uint256 tokenPrice,
                uint256
            ) {
                amountInUSD = (amount * tokenPrice) / 10 ** 18;
            } catch {
                // 如果价格查询失败，继续执行但美元价值为0
            }
        }

        emit BidPlaced(msg.sender, amount, amountInUSD);
    }

    /**
     * @dev 结束拍卖函数
     * @notice 手动结束拍卖，触发拍卖结束事件
     * @dev 此函数可以由任何人调用，但拍卖必须已经结束
     * @dev 检查拍卖是否达到保留价格，并触发相应的事件
     * @dev 如果达到保留价格且有出价，宣布获胜者；否则宣布拍卖失败
     */
    function endAuction() external nonReentrant auctionEnded {
        require(auction.status == AuctionStatus.Active, "Auction not active");

        auction.status = AuctionStatus.Ended;

        // 检查是否达到保留价格
        bool hasMetReserve = auction.reservePrice == 0 ||
            auction.highestBid >= auction.reservePrice;

        if (auction.highestBidder != address(0) && hasMetReserve) {
            // 有有效出价且达到保留价格
            emit AuctionEnded(auction.highestBidder, auction.highestBid);
        } else {
            // 没有达到保留价格或无出价
            emit AuctionEnded(address(0), 0);
        }
    }

    /**
     * @dev 卖家领取资金函数
     * @notice 卖家在拍卖结束后领取拍卖所得资金
     * @dev 只有卖家可以调用此函数
     * @dev 如果拍卖达到保留价格且有出价，卖家获得资金；否则NFT退回给卖家
     * @dev 支持ETH和ERC20两种支付方式
     */
    function sellerClaimFunds() external nonReentrant {
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
     * @dev 只有最高出价者可以调用此函数
     * @dev 只有在拍卖达到保留价格时才能领取NFT
     * @dev 如果没有达到保留价格，NFT会退回给卖家
     */
    function highestBidderClaimNFT() external nonReentrant {
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
     * @dev 只有卖家可以取消拍卖，且必须在拍卖活跃期间
     * @dev 如果已经有人出价，则无法取消拍卖
     * @dev 取消后NFT会退回给卖家
     */
    function cancelAuction() external nonReentrant auctionIsActive {
        require(msg.sender == auction.seller, "Only seller can cancel");
        require(auction.highestBidder == address(0), "Cannot cancel with bids");

        auction.status = AuctionStatus.Cancelled;

        // 退回NFT给卖家
        IERC721(auction.nftContract).safeTransferFrom(
            address(this),
            auction.seller,
            auction.tokenId
        );

        emit AuctionCancelled();
    }

    /**
     * @dev 获取拍卖信息函数
     * @notice 查询拍卖的详细信息
     * @return 拍卖信息结构体
     * @dev 这是一个只读函数，不会修改合约状态
     */
    function getAuction() external view returns (AuctionInfo memory) {
        return auction;
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
     * @dev 只有合约所有者可以调用此函数
     * @dev 只能在拍卖结束30天后使用，防止过早干预
     * @dev 如果卖家未领取资金，将资金转给卖家
     * @dev 如果最高出价者未领取NFT，将NFT转给最高出价者
     * @dev 这是一个安全机制，用于处理用户忘记领取的情况
     */
    function emergencyWithdraw() external onlyOwner {
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

    /**
     * @dev 接收ETH的回退函数
     * @notice 允许合约接收ETH
     */
    receive() external payable {}
}
