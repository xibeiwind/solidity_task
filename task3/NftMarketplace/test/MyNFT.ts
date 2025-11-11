import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("MyNFT", function () {
  // 定义测试夹具，用于在每个测试中复用相同的部署设置
  async function deployMyNFTFixture() {
    // 获取测试账户
    const [owner, otherAccount, anotherAccount] = await ethers.getSigners();

    // 部署 MyNFT 合约
    const MyNFT = await ethers.getContractFactory("MyNFT");
    const myNFT = await MyNFT.deploy();

    return { myNFT, owner, otherAccount, anotherAccount };
  }

  describe("部署", function () {
    it("应该正确设置合约名称和符号", async function () {
      const { myNFT } = await loadFixture(deployMyNFTFixture);

      expect(await myNFT.name()).to.equal("MyNFT");
      expect(await myNFT.symbol()).to.equal("MNFT");
    });

    it("应该正确设置合约所有者", async function () {
      const { myNFT, owner } = await loadFixture(deployMyNFTFixture);

      expect(await myNFT.owner()).to.equal(owner.address);
    });
  });

  describe("铸造功能", function () {
    it("所有者应该能够铸造 NFT", async function () {
      const { myNFT, owner, otherAccount } = await loadFixture(deployMyNFTFixture);

      const tokenURI = "https://example.com/token/1";

      // 所有者铸造 NFT 给其他账户
      await expect(myNFT.safeMint(otherAccount.address, tokenURI))
        .to.emit(myNFT, "Transfer")
        .withArgs(ethers.ZeroAddress, otherAccount.address, 0);

      // 验证 NFT 所有权
      expect(await myNFT.ownerOf(0)).to.equal(otherAccount.address);

      // 验证 tokenURI
      expect(await myNFT.tokenURI(0)).to.equal(tokenURI);
    });

    it("非所有者不应该能够铸造 NFT", async function () {
      const { myNFT, otherAccount, anotherAccount } = await loadFixture(deployMyNFTFixture);

      const tokenURI = "https://example.com/token/1";

      // 非所有者尝试铸造 NFT 应该失败
      await expect(
        myNFT.connect(otherAccount).safeMint(anotherAccount.address, tokenURI)
      ).to.be.revertedWithCustomError(myNFT, "OwnableUnauthorizedAccount");
    });

    it("应该正确递增 tokenId", async function () {
      const { myNFT, owner, otherAccount } = await loadFixture(deployMyNFTFixture);

      const tokenURI1 = "https://example.com/token/1";
      const tokenURI2 = "https://example.com/token/2";

      // 铸造第一个 NFT
      const tokenId1 = await myNFT.safeMint(otherAccount.address, tokenURI1);
      console.log("tokenId1:", tokenId1.value);
      expect(tokenId1.nonce).to.equal(1);

      // 铸造第二个 NFT
      const tokenId2 = await myNFT.safeMint(otherAccount.address, tokenURI2);
      console.log("tokenId2:", tokenId2.value);
      expect(tokenId2.nonce).to.equal(2);

      // 验证两个 NFT 的所有权
      expect(await myNFT.ownerOf(0)).to.equal(otherAccount.address);
      expect(await myNFT.ownerOf(1)).to.equal(otherAccount.address);

      // 验证两个 NFT 的 tokenURI
      expect(await myNFT.tokenURI(0)).to.equal(tokenURI1);
      expect(await myNFT.tokenURI(1)).to.equal(tokenURI2);
    });

    it("应该能够铸造 NFT 给零地址", async function () {
      const { myNFT, owner } = await loadFixture(deployMyNFTFixture);

      const tokenURI = "https://example.com/token/1";

      // 铸造 NFT 给零地址应该失败
      await expect(
        myNFT.safeMint(ethers.ZeroAddress, tokenURI)
      ).to.be.revertedWithCustomError(myNFT, "ERC721InvalidReceiver");
    });
  });

  describe("tokenURI 功能", function () {
    it("应该正确返回 tokenURI", async function () {
      const { myNFT, owner, otherAccount } = await loadFixture(deployMyNFTFixture);

      const tokenURI = "https://example.com/token/1";

      // 铸造 NFT
      await myNFT.safeMint(otherAccount.address, tokenURI);

      // 验证 tokenURI
      expect(await myNFT.tokenURI(0)).to.equal(tokenURI);
    });

    it("查询不存在的 tokenId 应该失败", async function () {
      const { myNFT } = await loadFixture(deployMyNFTFixture);

      // 查询不存在的 tokenId 应该失败
      await expect(myNFT.tokenURI(999))
        .to.be.revertedWithCustomError(myNFT, "ERC721NonexistentToken");
    });
  });

  describe("支持接口", function () {
    it("应该支持 ERC721 接口", async function () {
      const { myNFT } = await loadFixture(deployMyNFTFixture);

      // ERC721 接口 ID
      const ERC721_INTERFACE_ID = "0x80ac58cd";

      expect(await myNFT.supportsInterface(ERC721_INTERFACE_ID)).to.be.true;
    });

    it("应该支持 ERC721Metadata 接口", async function () {
      const { myNFT } = await loadFixture(deployMyNFTFixture);

      // ERC721Metadata 接口 ID
      const ERC721_METADATA_INTERFACE_ID = "0x5b5e139f";

      expect(await myNFT.supportsInterface(ERC721_METADATA_INTERFACE_ID)).to.be.true;
    });

    it("应该支持 ERC165 接口", async function () {
      const { myNFT } = await loadFixture(deployMyNFTFixture);

      // ERC165 接口 ID
      const ERC165_INTERFACE_ID = "0x01ffc9a7";

      expect(await myNFT.supportsInterface(ERC165_INTERFACE_ID)).to.be.true;
    });
  });

  describe("NFT 转移", function () {
    it("NFT 所有者应该能够转移 NFT", async function () {
      const { myNFT, owner, otherAccount, anotherAccount } = await loadFixture(deployMyNFTFixture);

      const tokenURI = "https://example.com/token/1";

      // 所有者铸造 NFT 给 otherAccount
      await myNFT.safeMint(otherAccount.address, tokenURI);

      // otherAccount 转移 NFT 给 anotherAccount
      await expect(
        myNFT.connect(otherAccount).transferFrom(otherAccount.address, anotherAccount.address, 0)
      ).to.emit(myNFT, "Transfer")
        .withArgs(otherAccount.address, anotherAccount.address, 0);

      // 验证 NFT 所有权已转移
      expect(await myNFT.ownerOf(0)).to.equal(anotherAccount.address);
    });

    it("非所有者不应该能够转移 NFT", async function () {
      const { myNFT, owner, otherAccount, anotherAccount } = await loadFixture(deployMyNFTFixture);

      const tokenURI = "https://example.com/token/1";

      // 所有者铸造 NFT 给 otherAccount
      await myNFT.safeMint(otherAccount.address, tokenURI);

      // anotherAccount 尝试转移不属于自己的 NFT 应该失败
      await expect(
        myNFT.connect(anotherAccount).transferFrom(otherAccount.address, anotherAccount.address, 0)
      ).to.be.revertedWithCustomError(myNFT, "ERC721InsufficientApproval");
    });
  });

  describe("批量铸造", function () {
    it("应该能够批量铸造多个 NFT", async function () {
      const { myNFT, owner, otherAccount } = await loadFixture(deployMyNFTFixture);

      const tokenURIs = [
        "https://example.com/token/1",
        "https://example.com/token/2",
        "https://example.com/token/3"
      ];

      // 批量铸造 NFT
      for (let i = 0; i < tokenURIs.length; i++) {
        const tokenId = await myNFT.safeMint(otherAccount.address, tokenURIs[i]);
        expect(tokenId.nonce).to.equal(i+1);
        expect(await myNFT.ownerOf(i)).to.equal(otherAccount.address);
        expect(await myNFT.tokenURI(i)).to.equal(tokenURIs[i]);
      }

      // 验证总供应量
      expect(await myNFT.balanceOf(otherAccount.address)).to.equal(tokenURIs.length);
    });
  });
});
