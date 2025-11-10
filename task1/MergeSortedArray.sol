// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

contract MergeSortedArray {
    //将两个有序数组合并为一个有序数组。假设是升序数组
    function mergeSortedArray(uint256[] memory arr1, uint256[] memory arr2)
        external
        pure
        returns (uint256[] memory merged)
    {
        uint256 len1 = arr1.length;
        uint256 len2 = arr2.length;
        uint256 totalLength = len1 + len2;
        merged = new uint256[](totalLength);
        uint256 a1;
        uint256 a2;
        uint256 m1;
        while (a1 < len1 && a2 < len2) {
            if (arr1[a1] <= arr2[a2]) {
                merged[m1] = arr1[a1];
                a1++;
            } else {
                merged[m1] = arr2[a2];
                a2++;
            }
            m1++;
        }
        while (a1 < len1){
            merged[m1] = arr1[a1];
            a1++;
            m1++;
        }
        while (a2 < len2){
            merged[m1] = arr2[a2];
            a2++;
            m1++;
        }
    }
}
