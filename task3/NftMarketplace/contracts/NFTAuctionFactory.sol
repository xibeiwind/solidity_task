// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "./interfaces/INFTAuctionFactory.sol";
import "./SingleNFTAuction.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract NFTAuctionFactory is
    Initializable,
    OwnableUpgradeable,
    UUPSUpgradeable,
    INFTAuctionFactory
{
    address public feeTo; // 协议费用接收地址（如果为0地址，表示费用关闭）
    address public feeToSetter; // 有权设置 feeTo 地址的账户
    address[] public allAuctions;

    // 映射：拍卖地址 => 是否由本工厂创建
    mapping(address => bool) public isAuctionCreatedByFactory;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address initialOwner,
        address _feeToSetter
    ) public initializer {
        __Ownable_init(initialOwner);
        feeToSetter = _feeToSetter;
        feeTo = address(0);
    }

    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyOwner {}

    /**
     * @dev 创建新的NFT拍卖合约（UUPS可升级版本）
     * @param nftContract NFT合约地址
     * @param seller 卖家地址
     * @param tokenId NFT token ID
     * @param startingPrice 起拍价格
     * @param reservePrice 保留价格
     * @param duration 拍卖持续时间（秒）
     * @return auctionAddress 新创建的拍卖合约地址
     */
    function createAuction(
        address nftContract,
        address seller,
        uint256 tokenId,
        uint256 startingPrice,
        uint256 reservePrice,
        uint256 duration
    ) external returns (address) {
        require(
            nftContract != address(0),
            "NFTAuctionFactory: nftContract is zero address"
        );
        require(
            seller != address(0),
            "NFTAuctionFactory: seller is zero address"
        );
        require(startingPrice > 0, "NFTAuctionFactory: startingPrice is zero");
        require(duration > 0, "NFTAuctionFactory: duration is zero");

        // 部署SingleNFTAuction实现合约
        SingleNFTAuction implementation = new SingleNFTAuction();

        // 部署UUPS代理合约
        bytes memory initData = abi.encodeWithSelector(
            SingleNFTAuction.initialize.selector,
            seller, // initialOwner 设置为卖家
            address(0) // priceOracle 初始化为0地址，后续可以设置
        );

        ERC1967Proxy proxy = new ERC1967Proxy(
            address(implementation),
            initData
        );

        address auctionAddress = address(proxy);

        // 将新拍卖合约添加到列表
        allAuctions.push(auctionAddress);
        isAuctionCreatedByFactory[auctionAddress] = true;

        // 触发拍卖创建事件
        emit AuctionCreated(
            auctionAddress,
            nftContract,
            seller,
            tokenId,
            startingPrice,
            reservePrice,
            duration
        );

        return auctionAddress;
    }

    /**
     * @dev 获取所有拍卖合约的数量
     * @return 拍卖合约总数
     */
    function allAuctionsLength() external view returns (uint) {
        return allAuctions.length;
    }

    /**
     * @dev 设置协议费用接收地址
     * @param _feeTo 新的费用接收地址
     */
    function setFeeTo(address _feeTo) external {
        require(msg.sender == feeToSetter, "NFTAuctionFactory: FORBIDDEN");
        feeTo = _feeTo;
    }

    /**
     * @dev 设置费用设置者地址
     * @param _feeToSetter 新的费用设置者地址
     */
    function setFeeToSetter(address _feeToSetter) external {
        require(msg.sender == feeToSetter, "NFTAuctionFactory: FORBIDDEN");
        feeToSetter = _feeToSetter;
    }

    /**
     * @dev 检查地址是否是由本工厂创建的拍卖合约
     * @param auctionAddress 要检查的拍卖合约地址
     * @return 如果是本工厂创建的返回true，否则返回false
     */
    function isFactoryAuction(
        address auctionAddress
    ) external view returns (bool) {
        return isAuctionCreatedByFactory[auctionAddress];
    }
}
