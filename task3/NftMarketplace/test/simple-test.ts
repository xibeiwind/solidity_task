import { expect } from "chai";
import hre from "hardhat";

describe("简单测试", function () {
  it("应该能够部署合约", async function () {
    const MyNFT = await hre.ethers.getContractFactory("MyNFT");
    const myNFT = await MyNFT.deploy();
    
    expect(await myNFT.getAddress()).to.be.a("string");
    console.log("合约地址:", await myNFT.getAddress());
  });
  
  it("应该返回正确的名称和符号", async function () {
    const MyNFT = await hre.ethers.getContractFactory("MyNFT");
    const myNFT = await MyNFT.deploy();
    
    expect(await myNFT.name()).to.equal("MyNFT");
    expect(await myNFT.symbol()).to.equal("MNFT");
  });
});
