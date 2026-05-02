import { network } from "hardhat";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const { ethers } = await network.connect({ network: "sepolia" });

  const price = ethers.parseEther("0.01");

  console.log("Deploying DigitalItem with price:", price.toString(), "wei");

  const digitalItem = await ethers.deployContract("DigitalItem", [price]);
  await digitalItem.waitForDeployment();

  const address = await digitalItem.getAddress();
  console.log("DigitalItem deployed to:", address);

  // Save deployed address to file
  const outputPath = path.join(__dirname, "..", "deployed-address.json");
  fs.writeFileSync(
    outputPath,
    JSON.stringify({ address, network: "sepolia", price: price.toString() }, null, 2)
  );
  console.log("Deployed address saved to:", outputPath);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});