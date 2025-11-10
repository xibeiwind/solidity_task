// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

contract IntegerToRomain {
    function toRomain(uint256 num) external  pure returns (string memory) {
        require(num > 0 && num <= 3999, "Number must be between 1 and 3999");
        string[13] memory symbols = [
            "M",
            "CM",
            "D",
            "CD",
            "C",
            "XC",
            "L",
            "XL",
            "X",
            "IX",
            "V",
            "IV",
            "I"
        ];
        uint16[13] memory values = [
            1000,
            900,
            500,
            400,
            100,
            90,
            50,
            40,
            10,
            9,
            5,
            4,
            1
        ];

        string memory result = "";

         for (uint8 i = 0; i < symbols.length; i++) {
            while (num >= values[i]) {
                result = string(abi.encodePacked(result, symbols[i]));
                num -= values[i];
            }
        }
        
        return result;   
    }
}
