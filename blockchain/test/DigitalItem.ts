import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.connect();

describe("DigitalItem", function () {
  const PRICE = ethers.parseEther("0.01");

  async function deployDigitalItem() {
    const [owner, buyer, other] = await ethers.getSigners();
    const digitalItem = await ethers.deployContract("DigitalItem", [PRICE]);
    return { digitalItem, owner, buyer, other };
  }

  describe("Deployment", function () {
    it("Should set the correct owner", async function () {
      const { digitalItem, owner } = await deployDigitalItem();
      expect(await digitalItem.owner()).to.equal(owner.address);
    });

    it("Should set the correct price", async function () {
      const { digitalItem } = await deployDigitalItem();
      expect(await digitalItem.price()).to.equal(PRICE);
    });

    it("Should initialize purchaseCount to 0", async function () {
      const { digitalItem } = await deployDigitalItem();
      expect(await digitalItem.purchaseCount()).to.equal(0n);
    });
  });

  describe("buy()", function () {
    it("Should succeed with exact ETH amount", async function () {
      const { digitalItem, buyer } = await deployDigitalItem();
      await digitalItem.connect(buyer).buy({ value: PRICE });
      expect(await digitalItem.purchaseCount()).to.equal(1n);
    });

    it("Should record the purchase correctly", async function () {
      const { digitalItem, buyer } = await deployDigitalItem();
      await digitalItem.connect(buyer).buy({ value: PRICE });

      const purchase = await digitalItem.purchases(0n);
      expect(purchase.buyer).to.equal(buyer.address);
      expect(purchase.amount).to.equal(PRICE);
    });

    it("Should set hasPurchased to true for the buyer", async function () {
      const { digitalItem, buyer } = await deployDigitalItem();
      await digitalItem.connect(buyer).buy({ value: PRICE });
      expect(await digitalItem.hasPurchased(buyer.address)).to.be.true;
    });

    it("Should emit ItemPurchased event", async function () {
      const { digitalItem, buyer } = await deployDigitalItem();
      await expect(digitalItem.connect(buyer).buy({ value: PRICE }))
        .to.emit(digitalItem, "ItemPurchased")
        .withArgs(buyer.address, PRICE);
    });

    it("Should revert with IncorrectPayment if wrong ETH amount sent", async function () {
      const { digitalItem, buyer } = await deployDigitalItem();
      const wrongAmount = ethers.parseEther("0.02");
      await expect(
        digitalItem.connect(buyer).buy({ value: wrongAmount })
      ).to.be.revertedWithCustomError(digitalItem, "IncorrectPayment");
    });

    it("Should revert with IncorrectPayment if zero ETH sent", async function () {
      const { digitalItem, buyer } = await deployDigitalItem();
      await expect(
        digitalItem.connect(buyer).buy({ value: 0n })
      ).to.be.revertedWithCustomError(digitalItem, "IncorrectPayment");
    });

    it("Should revert with AlreadyPurchased if same address buys twice", async function () {
      const { digitalItem, buyer } = await deployDigitalItem();
      await digitalItem.connect(buyer).buy({ value: PRICE });
      await expect(
        digitalItem.connect(buyer).buy({ value: PRICE })
      ).to.be.revertedWithCustomError(digitalItem, "AlreadyPurchased");
    });

    it("Should increment purchaseCount for multiple buyers", async function () {
      const { digitalItem, buyer, other } = await deployDigitalItem();
      await digitalItem.connect(buyer).buy({ value: PRICE });
      await digitalItem.connect(other).buy({ value: PRICE });
      expect(await digitalItem.purchaseCount()).to.equal(2n);
    });
  });

  describe("updatePrice()", function () {
    it("Should update price when called by owner", async function () {
      const { digitalItem } = await deployDigitalItem();
      const newPrice = ethers.parseEther("0.05");
      await digitalItem.updatePrice(newPrice);
      expect(await digitalItem.price()).to.equal(newPrice);
    });

    it("Should emit PriceUpdated event", async function () {
      const { digitalItem } = await deployDigitalItem();
      const newPrice = ethers.parseEther("0.05");
      await expect(digitalItem.updatePrice(newPrice))
        .to.emit(digitalItem, "PriceUpdated")
        .withArgs(newPrice);
    });

    it("Should revert with NotOwner when called by non-owner", async function () {
      const { digitalItem, buyer } = await deployDigitalItem();
      const newPrice = ethers.parseEther("0.05");
      await expect(
        digitalItem.connect(buyer).updatePrice(newPrice)
      ).to.be.revertedWithCustomError(digitalItem, "NotOwner");
    });
  });

  describe("withdraw()", function () {
    it("Should transfer balance to owner and emit Withdrawn", async function () {
      const { digitalItem, owner, buyer } = await deployDigitalItem();

      // First make a purchase so the contract has a balance
      await digitalItem.connect(buyer).buy({ value: PRICE });

      // Verify contract has the funds
      const contractAddr = await digitalItem.getAddress();
      expect(await ethers.provider.getBalance(contractAddr)).to.equal(PRICE);

      // Withdraw and check
      await expect(digitalItem.withdraw())
        .to.emit(digitalItem, "Withdrawn")
        .withArgs(owner.address, PRICE);

      // Contract balance should now be 0
      expect(await ethers.provider.getBalance(contractAddr)).to.equal(0n);
    });

    it("Should revert with NotOwner when called by non-owner", async function () {
      const { digitalItem, buyer } = await deployDigitalItem();
      await expect(
        digitalItem.connect(buyer).withdraw()
      ).to.be.revertedWithCustomError(digitalItem, "NotOwner");
    });
  });
});
