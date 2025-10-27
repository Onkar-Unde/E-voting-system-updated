const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  const EVoting = await hre.ethers.getContractFactory("EVoting");
  const evoting = await EVoting.deploy();
  await evoting.waitForDeployment();

  const address = await evoting.getAddress();
  console.log("Contract deployed to:", address);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
