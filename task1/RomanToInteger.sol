// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

contract RomanToInteger {
    mapping(bytes1 => uint256) private romanValues;

    constructor() {
        romanValues["I"] = 1;
        romanValues["V"] = 5;
        romanValues["X"] = 10;
        romanValues["L"] = 50;
        romanValues["C"] = 100;
        romanValues["D"] = 500;
        romanValues["M"] = 1000;
    }

    function toInteger(string memory roman) external view returns (uint256) {
        bytes memory romanBytes = bytes(roman);
        uint256 total = 0;
        uint256 i = 0;
        while (i < romanBytes.length) {
            uint256 currentValue = romanValues[romanBytes[i]];
            if (i + 1 < romanBytes.length) {
                uint256 nextValue = romanValues[romanBytes[i + 1]];
                if (currentValue < nextValue) {
                    // 减法情况：如 IV (4), IX (9), XL (40) 等
                    total += (nextValue - currentValue);
                    i += 2; // 跳过两个字符
                    continue;
                }
            }
            // 正常加法情况
            total += currentValue;
            i++;
        }
        return total;
    }
}
