import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("DigitalItemModule", (m) => {
  const digitalItem = m.contract("DigitalItem", [10000000000000000n]); // 0.01 ETH in wei

  return { digitalItem };
});
