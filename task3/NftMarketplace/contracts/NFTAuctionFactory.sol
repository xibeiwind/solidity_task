// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "./interfaces/INFTAuctionFactory.sol";

contract NFTAuctionFactory is INFTAuctionFactory {
    address public feeTo; // 协议费用接收地址（如果为0地址，表示费用关闭）
    address public feeToSetter; // 有权设置 feeTo 地址的账户
    address[] public allAuctions;

    constructor(address _feeToSetter) {
        feeToSetter = _feeToSetter;
    }

    function createAuction(
        address nftAddress,
        address seller,
        uint256 tokenId,
        uint256 startingPrice,
        uint256 endingPrice,
        uint256 duration
    ) external returns (address) {
        require(
            nftAddress != address(0),
            "NFTAuctionFactory: nftAddress is zero address"
        );
        require(
            seller != address(0),
            "NFTAuctionFactory: seller is zero address"
        );
        require(startingPrice > 0, "NFTAuctionFactory: startingPrice is zero");
    }

    function allAuctionsLength() external view returns (uint) {
        return allAuctions.length;
    }
    function setFeeTo(address _feeTo) external {
        feeTo = _feeTo;
    }
    function setFeeToSetter(address _feeToSetter) external {
        feeToSetter = _feeToSetter;
    }
}
