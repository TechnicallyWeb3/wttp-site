// Standalone version of deploy - works with standard ethers.js
import { ethers, Contract, ContractFactory, Provider, Signer } from "ethers";
import { DEFAULT_HEADER } from "@wttp/core";
// Import artifact directly to avoid loading tasks
import Web3SiteArtifact from "../../artifacts/contracts/Web3Site.sol/Web3Site.json";
import { getChainSymbol } from "../utils";

export interface DeployOptions {
  provider: Provider;
  signer: Signer;
  ownerAddress: string;
  dprAddress: string;
  defaultHeader?: typeof DEFAULT_HEADER;
  autoFund?: boolean;
}

export interface DeployResult {
  contract: Contract;
  address: string;
  deployerAddress: string;
  ownerAddress: string;
  dprAddress: string;
  txHash: string;
  actualCost: bigint;
}

/**
 * Deploy a Web3Site contract using standard ethers.js
 */
export async function deployWeb3Site(
  options: DeployOptions
): Promise<DeployResult> {
  const {
    provider,
    signer,
    ownerAddress,
    dprAddress,
    defaultHeader = DEFAULT_HEADER,
    autoFund = false
  } = options;

  const currencySymbol = await getChainSymbol(provider);
  if (!signer) {
    throw new Error("Signer is required");
  }
  const deployerAddress = await signer.getAddress();
  
  console.log(`🚀 Deploying Web3Site...`);
  console.log(`   Deployer: ${deployerAddress}`);
  console.log(`   Owner: ${ownerAddress}`);
  console.log(`   DPR: ${dprAddress}`);
  
  // Check balances
  const deployerBalance = await provider.getBalance(deployerAddress);
  const ownerBalance = await provider.getBalance(ownerAddress);
  
  console.log(`💰 Deployer balance: ${ethers.formatEther(deployerBalance)} ${currencySymbol}`);
  console.log(`💰 Owner balance: ${ethers.formatEther(ownerBalance)} ${currencySymbol}`);
  
  // Estimate deployment cost
  const Web3SiteFactory = new ContractFactory(
    Web3SiteArtifact.abi,
    Web3SiteArtifact.bytecode,
    signer
  );
  
  let gasEstimate: bigint;
  try {
    gasEstimate = await Web3SiteFactory.getDeployTransaction(
      ownerAddress,
      dprAddress,
      defaultHeader
    ).then(tx => provider.estimateGas(tx));
  } catch (error) {
    console.warn(`⚠️ Could not estimate gas, using default: ${error}`);
    gasEstimate = 2000000n; // Conservative default
  }
  
  const feeData = await provider.getFeeData();
  const gasPrice = feeData.gasPrice || feeData.maxFeePerGas || ethers.parseUnits("20", "gwei");
  const estimatedCost = gasEstimate * gasPrice * 110n / 100n; // 10% buffer
  
  console.log(`⛽ Estimated cost: ${ethers.formatEther(estimatedCost)} ${currencySymbol} (${gasEstimate.toString()} gas)`);
  
  // Check if funding is needed
  if (deployerBalance < estimatedCost) {
    const fundingNeeded = estimatedCost - deployerBalance;
    console.log(`⚠️  Deployer needs funding: ${ethers.formatEther(fundingNeeded)} ${currencySymbol}`);
    
    if (!autoFund) {
      throw new Error("Insufficient deployer balance. Set autoFund=true or fund manually.");
    }
    
    if (ownerBalance < fundingNeeded) {
      throw new Error(`Owner has insufficient funds. Needed: ${ethers.formatEther(fundingNeeded)} ${currencySymbol}, Available: ${ethers.formatEther(ownerBalance)} ${currencySymbol}`);
    }
    
    // Get owner signer (assuming same provider)
    // Note: In a real scenario, you'd need to pass the owner signer separately
    console.log(`💸 Funding deployer with ${ethers.formatEther(fundingNeeded)} ${currencySymbol}...`);
    console.warn(`⚠️  Note: Auto-funding requires owner signer. Please fund manually or provide owner signer.`);
    // For now, we'll just throw an error - in a full implementation, you'd handle this
    throw new Error("Auto-funding requires owner signer. Please fund deployer manually or provide owner signer in options.");
  }
  
  // Deploy Web3Site
  console.log(`🚀 Deploying Web3Site contract...`);
  const initialBalance = await provider.getBalance(deployerAddress);
  
  const web3Site = await Web3SiteFactory.deploy(
    ownerAddress,
    dprAddress,
    defaultHeader
  ) as Contract;
  
  await web3Site.waitForDeployment();

  // Verify contract works by calling DPS()
  const dpsFromSite = await web3Site.DPS();
  console.log(`🧪 Testing contract...`);
  console.log(`   DPS from site: ${dpsFromSite}`);
  console.log(`   ✅ Contract functional`);

  const address = await web3Site.getAddress();
  const txHash = web3Site.deploymentTransaction()?.hash || "unknown";
  
  const finalBalance = await provider.getBalance(deployerAddress);
  const actualCost = initialBalance - finalBalance;
  
  console.log(`✅ Web3Site deployed successfully!`);
  console.log(`📍 Address: ${address}`);
  console.log(`🔗 Transaction: ${txHash}`);
  console.log(`💰 Actual cost: ${ethers.formatEther(actualCost)} ${currencySymbol}`);
  
  // Test contract
  try {
    const dprFromSite = await web3Site.DPR();
    console.log(`🧪 Testing contract...`);
    console.log(`   DPR from site: ${dprFromSite}`);
    if (dprFromSite.toLowerCase() !== dprAddress.toLowerCase()) {
      throw new Error(`DPR address mismatch: expected ${dprAddress}, got ${dprFromSite}`);
    }
    console.log(`   ✅ Contract functional`);
  } catch (error) {
    console.error(`   ❌ Contract test failed: ${error}`);
    throw error;
  }
  
  return {
    contract: web3Site,
    address,
    deployerAddress,
    ownerAddress,
    dprAddress,
    txHash,
    actualCost
  };
}
