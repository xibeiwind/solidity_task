// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * 极简 NFT 合约
 *  - 继承 ERC721URIStorage：自动把 tokenURI 存到链上
 *  - 继承 Ownable：只有合约拥有者可以调用 mintNFT（可改成 public）
 */
contract MyNFT is ERC721URIStorage, Ownable {
    uint256 private _nextTokenId;

    /**
     * 构造函数：设置 NFT 名称 + 符号
     */
    constructor()
        ERC721("MyNFT", "MNFT")
        Ownable(msg.sender)   // OpenZeppelin v5 要求显式传入首个 owner
    {
        _nextTokenId = 1;     // 从 1 开始编号（可选）
    }

    /**
     * 铸造函数
     * @param to        接收者地址
     * @param metadata  元数据 URI（ipfs://<CID>/metadata.json）
     */
    function mintNFT(address to, string calldata metadata)
        external
        onlyOwner
        returns (uint256 tokenId)
    {
        tokenId = _nextTokenId++;
        _mint(to, tokenId);
        _setTokenURI(tokenId, metadata);
    }
}