// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

/**
 * @title MockAggregatorV3
 * @dev 模拟Chainlink AggregatorV3Interface，用于测试环境
 * @notice 提供可配置的价格数据，便于测试ChainlinkPriceOracle
 */
contract MockAggregatorV3 is AggregatorV3Interface {
    uint8 private _decimals;
    string private _description;
    uint256 private _version;
    
    // 价格数据
    struct RoundData {
        uint80 roundId;
        int256 answer;
        uint256 startedAt;
        uint256 updatedAt;
        uint80 answeredInRound;
    }
    
    RoundData private _latestRoundData;
    
    /**
     * @dev 构造函数
     * @param initialPrice 初始价格（8位小数）
     * @param decimals 小数位数
     * @param description 描述信息
     */
    constructor(
        int256 initialPrice,
        uint8 decimals,
        string memory description
    ) {
        _decimals = decimals;
        _description = description;
        _version = 1;
        
        // 设置初始价格数据
        _latestRoundData = RoundData({
            roundId: 1,
            answer: initialPrice,
            startedAt: block.timestamp - 3600, // 1小时前
            updatedAt: block.timestamp,
            answeredInRound: 1
        });
    }
    
    /**
     * @dev 获取最新价格数据
     * @inheritdoc AggregatorV3Interface
     */
    function latestRoundData()
        external
        view
        override
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        return (
            _latestRoundData.roundId,
            _latestRoundData.answer,
            _latestRoundData.startedAt,
            _latestRoundData.updatedAt,
            _latestRoundData.answeredInRound
        );
    }
    
    /**
     * @dev 获取小数位数
     * @inheritdoc AggregatorV3Interface
     */
    function decimals() external view override returns (uint8) {
        return _decimals;
    }
    
    /**
     * @dev 获取描述信息
     * @inheritdoc AggregatorV3Interface
     */
    function description() external view override returns (string memory) {
        return _description;
    }
    
    /**
     * @dev 获取版本号
     * @inheritdoc AggregatorV3Interface
     */
    function version() external view override returns (uint256) {
        return _version;
    }
    
    /**
     * @dev 获取指定轮次的价格数据（简化实现）
     * @inheritdoc AggregatorV3Interface
     */
    function getRoundData(uint80 _roundId)
        external
        view
        override
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        // 简化实现，总是返回最新数据
        return (
            _latestRoundData.roundId,
            _latestRoundData.answer,
            _latestRoundData.startedAt,
            _latestRoundData.updatedAt,
            _latestRoundData.answeredInRound
        );
    }
    
    /**
     * @dev 设置价格（仅用于测试）
     * @param price 新的价格
     * @param roundId 轮次ID
     */
    function setPrice(int256 price, uint80 roundId) external {
        _latestRoundData = RoundData({
            roundId: roundId,
            answer: price,
            startedAt: block.timestamp - 3600,
            updatedAt: block.timestamp,
            answeredInRound: roundId
        });
    }
    
    /**
     * @dev 设置过时价格（用于测试过时价格场景）
     * @param price 价格
     * @param staleTimestamp 过时时间戳
     */
    function setStalePrice(int256 price, uint256 staleTimestamp) external {
        _latestRoundData = RoundData({
            roundId: 1,
            answer: price,
            startedAt: staleTimestamp - 3600,
            updatedAt: staleTimestamp,
            answeredInRound: 1
        });
    }
    
    /**
     * @dev 设置无效价格数据（用于测试错误场景）
     * @param roundId 轮次ID
     * @param answeredInRound 回答轮次
     */
    function setInvalidData(uint80 roundId, uint80 answeredInRound) external {
        _latestRoundData = RoundData({
            roundId: roundId,
            answer: 0, // 无效价格
            startedAt: block.timestamp - 3600,
            updatedAt: 0, // 无效时间戳
            answeredInRound: answeredInRound
        });
    }
}
