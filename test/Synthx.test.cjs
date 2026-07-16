const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Synthx FX redemption logic", function () {
  async function setupJpyPosition() {
    const [owner, user] = await ethers.getSigners();
    const Synthx = await ethers.getContractFactory("Synthx");
    const synthx = await Synthx.deploy();
    await synthx.waitForDeployment();

    const oneFlr = ethers.parseEther("1");
    const initialJpyPrice = ethers.parseEther("162");
    const strongerJpyPrice = ethers.parseEther("146");

    await synthx.updatePrice("sjpy", initialJpyPrice);

    await synthx.connect(user).mintSynth("sjpy", oneFlr, {
      value: oneFlr,
    });

    const tokenAddress = await synthx.synthTokens("sjpy");
    const token = await ethers.getContractAt("SynthAsset", tokenAddress);
    const mintedJpy = await token.balanceOf(user.address);

    expect(mintedJpy).to.equal(ethers.parseEther("162"));

    await synthx.updatePrice("sjpy", strongerJpyPrice);

    return { owner, user, synthx, token, mintedJpy, oneFlr, strongerJpyPrice };
  }

  it("reverts profitable burns if the contract does not have enough FLR buffer", async function () {
    const { user, synthx, mintedJpy } = await setupJpyPosition();

    await expect(
      synthx.connect(user).burnSynth("sjpy", mintedJpy)
    ).to.be.revertedWith("Insufficient FLR liquidity");
  });

  it("returns more than 1 FLR when JPY strengthens from 162 to 146 and reserve liquidity exists", async function () {
    const { owner, user, synthx, token, mintedJpy, oneFlr, strongerJpyPrice } = await setupJpyPosition();

    await synthx.connect(owner).provideReserve({
      value: ethers.parseEther("0.2"),
    });

    const vaultBalanceBeforeBurn = await ethers.provider.getBalance(await synthx.getAddress());
    const expectedFlrReturned = (mintedJpy * oneFlr) / strongerJpyPrice;

    await synthx.connect(user).burnSynth("sjpy", mintedJpy);

    const vaultBalanceAfterBurn = await ethers.provider.getBalance(await synthx.getAddress());
    const actualFlrReturned = vaultBalanceBeforeBurn - vaultBalanceAfterBurn;

    expect(actualFlrReturned).to.equal(expectedFlrReturned);
    expect(actualFlrReturned).to.be.gt(oneFlr);
    expect(await token.balanceOf(user.address)).to.equal(0n);
  });

  it("tracks reserve LP shares and allows withdrawing only the free reserve", async function () {
    const [owner] = await ethers.getSigners();
    const Synthx = await ethers.getContractFactory("Synthx");
    const synthx = await Synthx.deploy();
    await synthx.waitForDeployment();

    const reserveDeposit = ethers.parseEther("0.5");

    await synthx.connect(owner).provideReserve({
      value: reserveDeposit,
    });

    const mintedShares = await synthx.reserveShares(owner.address);
    expect(mintedShares).to.equal(reserveDeposit);

    const preview = await synthx.previewReserveWithdrawal(mintedShares);
    expect(preview).to.equal(reserveDeposit);

    const balanceBefore = await ethers.provider.getBalance(owner.address);
    const tx = await synthx.connect(owner).withdrawReserve(mintedShares);
    const receipt = await tx.wait();
    const gasPaid = receipt.gasUsed * receipt.gasPrice;
    const balanceAfter = await ethers.provider.getBalance(owner.address);

    expect(balanceAfter + gasPaid - balanceBefore).to.equal(reserveDeposit);
    expect(await synthx.reserveShares(owner.address)).to.equal(0n);
  });
});
