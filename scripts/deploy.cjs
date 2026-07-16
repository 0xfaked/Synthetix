const hre = require("hardhat");

async function main() {
  console.log("Starting deployment to Flare Coston2 testnet...");

  // Get the contract factory
  const Synthx = await hre.ethers.getContractFactory("Synthx");

  // Deploy the contract
  console.log("Deploying Synthx contract...");
  const synthx = await Synthx.deploy();

  await synthx.waitForDeployment();

  const address = await synthx.getAddress();
  
  console.log("-----------------------------------------");
  console.log("✅ Synthx deployed successfully!");
  console.log("🌍 Network: Flare Coston2 Testnet");
  console.log("📄 Contract Address:", address);
  console.log("-----------------------------------------");
}

main().catch((error) => {
  console.error("Error during deployment:", error);
  process.exitCode = 1;
});
