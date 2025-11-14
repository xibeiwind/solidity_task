import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("MyToken", function () {
  // 定义测试夹具，用于在每个测试中复用相同的部署设置
  async function deployMyTokenFixture() {
    // 获取测试账户
    const [owner, otherAccount, anotherAccount] = await ethers.getSigners();

    // 部署 MyToken 合约
    const MyToken = await ethers.getContractFactory("MyToken");
    const myToken = await MyToken.deploy();

    return { myToken, owner, otherAccount, anotherAccount };
  }

  describe("部署", function () {
    it("应该正确设置代币名称和符号", async function () {
      const { myToken } = await loadFixture(deployMyTokenFixture);

      expect(await myToken.name()).to.equal("MyToken");
      expect(await myToken.symbol()).to.equal("MTK");
    });

    it("应该正确设置合约所有者", async function () {
      const { myToken, owner } = await loadFixture(deployMyTokenFixture);

      // 由于合约没有公开的 owner 函数，我们通过 mint 功能来验证所有者权限
      const amount = ethers.parseEther("1000");
      await expect(myToken.mint(owner.address, amount))
        .to.emit(myToken, "Transfer")
        .withArgs(ethers.ZeroAddress, owner.address, amount);
    });

    it("初始总供应量应该为零", async function () {
      const { myToken } = await loadFixture(deployMyTokenFixture);

      expect(await myToken.totalSupply()).to.equal(0);
    });
  });

  describe("铸造功能", function () {
    it("所有者应该能够铸造代币", async function () {
      const { myToken, owner, otherAccount } = await loadFixture(deployMyTokenFixture);

      const amount = ethers.parseEther("1000");

      // 所有者铸造代币给其他账户
      await expect(myToken.mint(otherAccount.address, amount))
        .to.emit(myToken, "Transfer")
        .withArgs(ethers.ZeroAddress, otherAccount.address, amount);

      // 验证代币余额
      expect(await myToken.balanceOf(otherAccount.address)).to.equal(amount);
      expect(await myToken.totalSupply()).to.equal(amount);
    });

    it("非所有者不应该能够铸造代币", async function () {
      const { myToken, otherAccount, anotherAccount } = await loadFixture(deployMyTokenFixture);

      const amount = ethers.parseEther("1000");

      // 非所有者尝试铸造代币应该失败
      await expect(
        myToken.connect(otherAccount).mint(anotherAccount.address, amount)
      ).to.be.revertedWith("Only owner can mint");
    });

    it("应该能够多次铸造代币", async function () {
      const { myToken, owner, otherAccount } = await loadFixture(deployMyTokenFixture);

      const amount1 = ethers.parseEther("500");
      const amount2 = ethers.parseEther("300");

      // 第一次铸造
      await myToken.mint(otherAccount.address, amount1);
      expect(await myToken.balanceOf(otherAccount.address)).to.equal(amount1);
      expect(await myToken.totalSupply()).to.equal(amount1);

      // 第二次铸造
      await myToken.mint(otherAccount.address, amount2);
      expect(await myToken.balanceOf(otherAccount.address)).to.equal(amount1 + amount2);
      expect(await myToken.totalSupply()).to.equal(amount1 + amount2);
    });

    it("应该能够铸造给不同地址", async function () {
      const { myToken, owner, otherAccount, anotherAccount } = await loadFixture(deployMyTokenFixture);

      const amount1 = ethers.parseEther("500");
      const amount2 = ethers.parseEther("300");

      // 铸造给第一个账户
      await myToken.mint(otherAccount.address, amount1);
      expect(await myToken.balanceOf(otherAccount.address)).to.equal(amount1);

      // 铸造给第二个账户
      await myToken.mint(anotherAccount.address, amount2);
      expect(await myToken.balanceOf(anotherAccount.address)).to.equal(amount2);

      // 验证总供应量
      expect(await myToken.totalSupply()).to.equal(amount1 + amount2);
    });
  });

  describe("ERC20 标准功能", function () {
    it("应该正确返回小数位数", async function () {
      const { myToken } = await loadFixture(deployMyTokenFixture);

      expect(await myToken.decimals()).to.equal(18);
    });
  });

  describe("代币转移", function () {
    it("代币持有者应该能够转移代币", async function () {
      const { myToken, owner, otherAccount, anotherAccount } = await loadFixture(deployMyTokenFixture);

      const amount = ethers.parseEther("1000");

      // 所有者铸造代币给 otherAccount
      await myToken.mint(otherAccount.address, amount);

      const transferAmount = ethers.parseEther("500");

      // otherAccount 转移代币给 anotherAccount
      await expect(
        myToken.connect(otherAccount).transfer(anotherAccount.address, transferAmount)
      ).to.emit(myToken, "Transfer")
        .withArgs(otherAccount.address, anotherAccount.address, transferAmount);

      // 验证代币余额
      expect(await myToken.balanceOf(otherAccount.address)).to.equal(amount - transferAmount);
      expect(await myToken.balanceOf(anotherAccount.address)).to.equal(transferAmount);
    });

    it("余额不足时转移应该失败", async function () {
      const { myToken, owner, otherAccount, anotherAccount } = await loadFixture(deployMyTokenFixture);

      const amount = ethers.parseEther("1000");
      const transferAmount = ethers.parseEther("1500");

      // 所有者铸造代币给 otherAccount
      await myToken.mint(otherAccount.address, amount);

      // otherAccount 尝试转移超过余额的代币应该失败
      await expect(
        myToken.connect(otherAccount).transfer(anotherAccount.address, transferAmount)
      ).to.be.revertedWithCustomError(myToken, "ERC20InsufficientBalance");
    });
  });

  describe("授权和转移", function () {
    it("应该能够授权其他账户使用代币", async function () {
      const { myToken, owner, otherAccount, anotherAccount } = await loadFixture(deployMyTokenFixture);

      const amount = ethers.parseEther("1000");
      const approveAmount = ethers.parseEther("500");

      // 所有者铸造代币给 otherAccount
      await myToken.mint(otherAccount.address, amount);

      // otherAccount 授权 anotherAccount 使用代币
      await expect(
        myToken.connect(otherAccount).approve(anotherAccount.address, approveAmount)
      ).to.emit(myToken, "Approval")
        .withArgs(otherAccount.address, anotherAccount.address, approveAmount);

      // 验证授权额度
      expect(await myToken.allowance(otherAccount.address, anotherAccount.address)).to.equal(approveAmount);
    });

    it("被授权账户应该能够转移代币", async function () {
      const { myToken, owner, otherAccount, anotherAccount } = await loadFixture(deployMyTokenFixture);

      const amount = ethers.parseEther("1000");
      const approveAmount = ethers.parseEther("500");
      const transferAmount = ethers.parseEther("300");

      // 所有者铸造代币给 otherAccount
      await myToken.mint(otherAccount.address, amount);

      // otherAccount 授权 anotherAccount 使用代币
      await myToken.connect(otherAccount).approve(anotherAccount.address, approveAmount);

      // anotherAccount 从 otherAccount 转移代币给自己
      await expect(
        myToken.connect(anotherAccount).transferFrom(otherAccount.address, anotherAccount.address, transferAmount)
      ).to.emit(myToken, "Transfer")
        .withArgs(otherAccount.address, anotherAccount.address, transferAmount);

      // 验证余额和授权额度
      expect(await myToken.balanceOf(otherAccount.address)).to.equal(amount - transferAmount);
      expect(await myToken.balanceOf(anotherAccount.address)).to.equal(transferAmount);
      expect(await myToken.allowance(otherAccount.address, anotherAccount.address)).to.equal(approveAmount - transferAmount);
    });

    it("授权额度不足时转移应该失败", async function () {
      const { myToken, owner, otherAccount, anotherAccount } = await loadFixture(deployMyTokenFixture);

      const amount = ethers.parseEther("1000");
      const approveAmount = ethers.parseEther("500");
      const transferAmount = ethers.parseEther("600");

      // 所有者铸造代币给 otherAccount
      await myToken.mint(otherAccount.address, amount);

      // otherAccount 授权 anotherAccount 使用代币
      await myToken.connect(otherAccount).approve(anotherAccount.address, approveAmount);

      // anotherAccount 尝试转移超过授权额度的代币应该失败
      await expect(
        myToken.connect(anotherAccount).transferFrom(otherAccount.address, anotherAccount.address, transferAmount)
      ).to.be.revertedWithCustomError(myToken, "ERC20InsufficientAllowance");
    });

    it("余额不足时授权转移应该失败", async function () {
      const { myToken, owner, otherAccount, anotherAccount } = await loadFixture(deployMyTokenFixture);

      const amount = ethers.parseEther("1000");
      const approveAmount = ethers.parseEther("1500");
      const transferAmount = ethers.parseEther("1500");

      // 所有者铸造代币给 otherAccount
      await myToken.mint(otherAccount.address, amount);

      // otherAccount 授权 anotherAccount 使用代币
      await myToken.connect(otherAccount).approve(anotherAccount.address, approveAmount);

      // anotherAccount 尝试转移超过余额的代币应该失败
      await expect(
        myToken.connect(anotherAccount).transferFrom(otherAccount.address, anotherAccount.address, transferAmount)
      ).to.be.revertedWithCustomError(myToken, "ERC20InsufficientBalance");
    });
  });

  describe("批量操作", function () {
    it("应该能够批量铸造代币", async function () {
      const { myToken, owner, otherAccount, anotherAccount } = await loadFixture(deployMyTokenFixture);

      const amounts = [
        ethers.parseEther("100"),
        ethers.parseEther("200"),
        ethers.parseEther("300")
      ];

      const recipients = [
        otherAccount.address,
        anotherAccount.address,
        otherAccount.address
      ];

      // 批量铸造代币
      for (let i = 0; i < amounts.length; i++) {
        await myToken.mint(recipients[i], amounts[i]);
      }

      // 验证代币余额
      expect(await myToken.balanceOf(otherAccount.address)).to.equal(amounts[0] + amounts[2]);
      expect(await myToken.balanceOf(anotherAccount.address)).to.equal(amounts[1]);

      // 验证总供应量
      const totalSupply = amounts.reduce((sum, amount) => sum + amount, 0n);
      expect(await myToken.totalSupply()).to.equal(totalSupply);
    });

    it("应该能够批量转移代币", async function () {
      const { myToken, owner, otherAccount, anotherAccount } = await loadFixture(deployMyTokenFixture);

      const initialAmount = ethers.parseEther("1000");

      // 所有者铸造代币给 otherAccount
      await myToken.mint(otherAccount.address, initialAmount);

      const transferAmounts = [
        ethers.parseEther("100"),
        ethers.parseEther("200"),
        ethers.parseEther("300")
      ];

      // 批量转移代币给 anotherAccount
      for (const amount of transferAmounts) {
        await myToken.connect(otherAccount).transfer(anotherAccount.address, amount);
      }

      // 验证最终余额
      const totalTransferred = transferAmounts.reduce((sum, amount) => sum + amount, 0n);
      expect(await myToken.balanceOf(otherAccount.address)).to.equal(initialAmount - totalTransferred);
      expect(await myToken.balanceOf(anotherAccount.address)).to.equal(totalTransferred);
    });
  });


});
