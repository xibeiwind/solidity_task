// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

interface INFTAuctionFactory {
    event AuctionCreated(
        address auctionAddress,
        address seller
    );

    function createAuction(
        address seller
    ) external returns (address);

    function feeTo() external view returns (address);
    function feeToSetter() external view returns (address);

    function allAuctionsLength() external view returns (uint);
    function setFeeTo(address) external;
    function setFeeToSetter(address) external;
    
    function isFactoryAuction(address auctionAddress) external view returns (bool);
}
