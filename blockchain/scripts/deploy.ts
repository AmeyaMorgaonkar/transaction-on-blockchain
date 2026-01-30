// import { ethers } from "hardhat";

// async function main() {
//   const price = ethers.parseEther("0.01");

//   const DigitalItem = await ethers.getContractFactory("DigitalItem");
//   const contract = await DigitalItem.deploy(price);

//   await contract.waitForDeployment();

//   console.log("DigitalItem deployed to:", await contract.getAddress());
// }

// main().catch((error) => {
//   console.error(error);
//   process.exitCode = 1;
// });