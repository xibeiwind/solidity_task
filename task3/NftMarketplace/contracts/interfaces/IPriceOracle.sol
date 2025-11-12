// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

/**
 * @title IPriceOracle
 * @dev 价格预言机接口，定义获取代币美元价格的函数
 * @notice 提供ETH和ERC20代币的美元价格查询功能
 * @dev 支持多种ERC20代币的价格查询，包括稳定币和其他代币
 */
interface IPriceOracle {
    /**
     * @dev 获取ETH的美元价格
     * @notice 查询当前ETH的美元价格
     * @return price ETH的美元价格（8位小数精度）
     * @return timestamp 价格时间戳
     * @dev 返回的价格使用8位小数精度，与Chainlink标准一致
     */
    function getETHPrice() external view returns (uint256 price, uint256 timestamp);

    /**
     * @dev 获取ERC20代币的美元价格
     * @notice 查询指定ERC20代币的美元价格
     * @param token ERC20代币合约地址
     * @return price 代币的美元价格（8位小数精度）
     * @return timestamp 价格时间戳
     * @dev 返回的价格使用8位小数精度，与Chainlink标准一致
     */
    function getTokenPrice(address token) external view returns (uint256 price, uint256 timestamp);

    /**
     * @dev 获取ETH价格源地址
     * @notice 返回ETH/USD价格源的Chainlink聚合器地址
     * @return ETH/USD价格源地址
     */
    function getETHPriceFeed() external view returns (address);

    /**
     * @dev 获取代币价格源地址
     * @notice 返回指定代币/USD价格源的Chainlink聚合器地址
     * @param token ERC20代币合约地址
     * @return 代币/USD价格源地址
     */
    function getTokenPriceFeed(address token) external view returns (address);

    /**
     * @dev 检查价格源是否可用
     * @notice 验证指定价格源是否正常工作
     * @param priceFeed 价格源地址
     * @return 如果价格源可用返回true，否则返回false
     */
    function isPriceFeedAvailable(address priceFeed) external view returns (bool);
}
