// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "./interfaces/IPriceOracle.sol";

/**
 * @title MockPriceOracle
 * @dev 模拟价格预言机，用于测试环境
 * @notice 提供固定的ETH和ERC20代币价格，便于测试
 */
contract MockPriceOracle is IPriceOracle {
    // 固定价格
    uint256 private ETH_PRICE = 2000 * 1e8; // 2000美元，8位小数
    uint256 private TOKEN_PRICE = 1 * 1e8; // 1美元，8位小数

    // 模拟价格源地址
    address private constant MOCK_ETH_FEED =
        0x1111111111111111111111111111111111111111;
    address private constant MOCK_TOKEN_FEED =
        0x2222222222222222222222222222222222222222;

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
        return (ETH_PRICE, block.timestamp);
    }

    /**
     * @dev 获取ERC20代币的美元价格
     * @inheritdoc IPriceOracle
     */
    function getTokenPrice(
        address
    ) external view override returns (uint256 price, uint256 timestamp) {
        return (TOKEN_PRICE, block.timestamp);
    }

    /**
     * @dev 获取ETH价格源地址
     * @inheritdoc IPriceOracle
     */
    function getETHPriceFeed() external pure override returns (address) {
        return MOCK_ETH_FEED;
    }

    /**
     * @dev 获取代币价格源地址
     * @inheritdoc IPriceOracle
     */
    function getTokenPriceFeed(
        address
    ) external pure override returns (address) {
        return MOCK_TOKEN_FEED;
    }

    /**
     * @dev 检查价格源是否可用
     * @inheritdoc IPriceOracle
     */
    function isPriceFeedAvailable(
        address
    ) external pure override returns (bool) {
        return true;
    }

    /**
     * @dev 设置自定义ETH价格（仅用于测试）
     * @param _price 新的ETH价格（8位小数）
     */
    function setETHPrice(uint256 _price) external {
        ETH_PRICE = _price;
    }

    /**
     * @dev 设置自定义代币价格（仅用于测试）
     * @param _price 新的代币价格（8位小数）
     */
    function setTokenPrice(address, uint256 _price) external {
        TOKEN_PRICE = _price;
    }
}
