// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

contract ReverseString {
    function revertString(string memory input) external pure returns (string memory result) {
        bytes memory inputBytes = bytes(input);
        uint256 len = inputBytes.length;
        bytes memory output = new bytes(len);

        for (uint256 i = 0; i < len; i++) {
            output[len - i - 1] = inputBytes[i];
        }

        result = string(output);
    }
}
