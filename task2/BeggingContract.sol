// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;
import "@openzeppelin/contracts/access/Ownable.sol";

contract BeggingContract is Ownable {
    mapping(address donor => uint256) private donations;
    event Donation(address donor, uint256 amount);
    constructor() Ownable(msg.sender) {}

    function donate() external payable {
        donations[msg.sender] += msg.value;
        emit Donation(msg.sender, msg.value);
    }

    function withdraw() external onlyOwner {        
        payable(owner()).transfer(address(this).balance);
    }

    function getDonation(address donor) external view returns (uint256) {
        return donations[donor];
    }

}
