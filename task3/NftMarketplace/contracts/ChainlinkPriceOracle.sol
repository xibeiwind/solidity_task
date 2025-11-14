// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";
import "./interfaces/IPriceOracle.sol";

/**
 * @title ChainlinkPriceOracle
 * @dev Chainlink价格预言机实现，提供ETH和ERC20代币的美元价格查询
 * @notice 集成Chainlink价格源，支持实时价格查询和缓存
 * @dev 使用Chainlink的AggregatorV3Interface获取价格数据
 */
contract ChainlinkPriceOracle is IPriceOracle {
    // 价格源映射
    mapping(address => address) private _tokenPriceFeeds;
    address[] private _tokens;
    // ETH/USD价格源地址
    address private _ethPriceFeed;

    // 价格缓存结构
    struct PriceCache {
        uint256 price;
        uint256 timestamp;
        uint256 blockNumber;
    }

    // 价格缓存映射
    mapping(address => PriceCache) private _priceCache;

    // 缓存有效期（秒）
    uint256 private constant CACHE_DURATION = 300; // 5分钟

    // 事件定义
    event PriceFeedUpdated(address indexed token, address priceFeed);
    event PriceCacheUpdated(
        address indexed token,
        uint256 price,
        uint256 timestamp
    );

    /**
     * @dev 构造函数
     * @param ethPriceFeed ETH/USD价格源地址
     * @notice 初始化ETH价格源
     */
    constructor(address ethPriceFeed) {
        require(ethPriceFeed != address(0), "Invalid ETH price feed");
        _ethPriceFeed = ethPriceFeed;
    }

    /**
     * @dev 设置代币价格源
     * @notice 添加或更新ERC20代币的价格源
     * @param token ERC20代币合约地址
     * @param priceFeed 代币/USD价格源地址
     */
    function setTokenPriceFeed(address token, address priceFeed) external {
        require(token != address(0), "Invalid token address");
        require(priceFeed != address(0), "Invalid price feed");
        if (_tokenPriceFeeds[token] == address(0)) {
            _tokens.push(token);
        }
        _tokenPriceFeeds[token] = priceFeed;
        emit PriceFeedUpdated(token, priceFeed);
    }

    function updatePriceCache(bool forceUpdate) external {
        // 获取所有价格源
        uint256 length = _tokens.length;
        // 更新eth价格
        {
            (uint256 price, uint256 timestamp) = _getPriceFromFeed(
                _ethPriceFeed,
                false
            );
            _updatePriceCache(_ethPriceFeed, price, timestamp);
        }
        // 遍历token价格源
        for (uint i = 0; i < length; i++) {
            address priceFeed = _tokenPriceFeeds[_tokens[i]];
            PriceCache memory cache = _priceCache[priceFeed];
            if (!forceUpdate && _isCacheValid(cache)) {
                return;
            }
            (uint256 price, uint256 timestamp) = _getPriceFromFeed(
                priceFeed,
                false
            );
            _updatePriceCache(priceFeed, price, timestamp);
        }
    }
    /**
     * @dev 获取ETH的美元价格
     * @inheritdoc IPriceOracle
     */
    function getETHPrice()
        external
        view
        override
        returns (uint256 price, uint256 timestamp)
    {
        return _getPriceFromFeed(_ethPriceFeed, true);
    }

    /**
     * @dev 获取ERC20代币的美元价格
     * @inheritdoc IPriceOracle
     */
    function getTokenPrice(
        address token
    ) external view override returns (uint256 price, uint256 timestamp) {
        address priceFeed = _tokenPriceFeeds[token];
        require(priceFeed != address(0), "Price feed not set for token");
        // 检查缓存是否有效
        PriceCache memory cache = _priceCache[priceFeed];
        if (_isCacheValid(cache)) {
            return (cache.price, cache.timestamp);
        }
        return _getPriceFromFeed(priceFeed, true);
    }

    /**
     * @dev 获取ETH价格源地址
     * @inheritdoc IPriceOracle
     */
    function getETHPriceFeed() external view override returns (address) {
        return _ethPriceFeed;
    }

    /**
     * @dev 获取代币价格源地址
     * @inheritdoc IPriceOracle
     */
    function getTokenPriceFeed(
        address token
    ) external view override returns (address) {
        return _tokenPriceFeeds[token];
    }

    /**
     * @dev 检查价格源是否可用
     * @inheritdoc IPriceOracle
     */
    function isPriceFeedAvailable(
        address priceFeed
    ) external view override returns (bool) {
        if (priceFeed == address(0)) {
            return false;
        }

        try AggregatorV3Interface(priceFeed).latestRoundData() returns (
            uint80,
            int256 answer,
            uint256,
            uint256 updatedAt,
            uint80
        ) {
            return answer > 0 && block.timestamp <= updatedAt + 2 hours;
        } catch {
            return false;
        }
    }

    /**
     * @dev 内部函数：从价格源获取价格
     * @param priceFeed 价格源地址
     * @return price 价格（8位小数精度）
     * @return timestamp 价格时间戳
     */
    function _getPriceFromFeed(
        address priceFeed,
        bool cacheFirst
    ) internal view returns (uint256 price, uint256 timestamp) {
        require(priceFeed != address(0), "Invalid price feed");

        // 检查缓存是否有效
        PriceCache memory cache = _priceCache[priceFeed];
        if (cacheFirst && _isCacheValid(cache)) {
            return (cache.price, cache.timestamp);
        }

        // 从Chainlink获取最新价格
        (
            uint80 roundId,
            int256 answer,
            ,
            uint256 updatedAt,
            uint80 answeredInRound
        ) = AggregatorV3Interface(priceFeed).latestRoundData();

        // 验证价格数据
        require(answer > 0, "Invalid price");
        require(updatedAt > 0, "Round not complete");
        require(answeredInRound >= roundId, "Stale price");

        // 返回价格（转换为uint256）
        return (uint256(answer), updatedAt);
    }

    /**
     * @dev 内部函数：检查缓存是否有效
     * @param cache 价格缓存
     * @return 如果缓存有效返回true，否则返回false
     */
    function _isCacheValid(
        PriceCache memory cache
    ) internal view returns (bool) {
        return
            cache.timestamp > 0 &&
            block.timestamp <= cache.timestamp + CACHE_DURATION &&
            cache.blockNumber <= block.number;
    }


    /**
     * @dev 更新价格缓存（仅内部使用）
     * @notice 更新指定价格源的缓存
     * @param priceFeed 价格源地址
     * @param price 价格
     * @param timestamp 时间戳
     */
    function _updatePriceCache(
        address priceFeed,
        uint256 price,
        uint256 timestamp
    ) internal {
        _priceCache[priceFeed] = PriceCache({
            price: price,
            timestamp: timestamp,
            blockNumber: block.number
        });

        emit PriceCacheUpdated(priceFeed, price, timestamp);
    }

    /**
     * @dev 获取缓存有效期
     * @return 缓存有效期（秒）
     */
    function getCacheDuration() external pure returns (uint256) {
        return CACHE_DURATION;
    }

    /**
     * @dev 获取价格缓存信息
     * @param priceFeed 价格源地址
     * @return price 缓存价格
     * @return timestamp 缓存时间戳
     * @return blockNumber 缓存区块号
     */
    function getPriceCache(
        address priceFeed
    )
        external
        view
        returns (uint256 price, uint256 timestamp, uint256 blockNumber)
    {
        PriceCache memory cache = _priceCache[priceFeed];
        return (cache.price, cache.timestamp, cache.blockNumber);
    }
}
