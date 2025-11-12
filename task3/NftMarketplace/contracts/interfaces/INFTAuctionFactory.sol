// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

interface INFTAuctionFactory {
    event AuctionCreated(
        address auctionAddress,
        address nftAddress,
        address seller,
        uint256 tokenId,
        uint256 startingPrice,
        uint256 endingPrice,
        uint256 duration
    );

    function createAuction(
        address nftAddress,
        address seller,
        uint256 tokenId,
        uint256 startingPrice,
        uint256 endingPrice,
        uint256 duration
    ) external returns (address);

    function feeTo() external view returns (address);
    function feeToSetter() external view returns (address);

    function allAuctionsLength() external view returns (uint);
    function setFeeTo(address) external;
    function setFeeToSetter(address) external;
}
