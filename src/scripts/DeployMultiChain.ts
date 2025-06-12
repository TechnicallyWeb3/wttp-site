import hre from "hardhat";
import { formatEther, parseUnits, toUtf8Bytes } from "ethers";
import { Web3Site } from "../../typechain-types";
import { addDeployment, formatDeploymentData } from './AddDeployment';
import { getContractAddress } from "@tw3/esp";

// Default header configuration for WTTP sites - updated to new structure
const DEFAULT_HEADER = {
  cache: {
    immutableFlag: false,
    preset: 3, // MEDIUM cache preset
    custom: ""
  },
  cors: {
    methods: 511, // All methods allowed (bitmask for all 9 methods)
    origins: [],
    preset: 1, // PUBLIC CORS preset
    custom: ""
  },
  redirect: {
    code: 0,
    location: ""
  }
};

// After DEFAULT_HEADER declaration, add exported interface
export interface DeploymentResult {
  chainId: number;
  networkName: string;
  contract: Web3Site;
  address: string;
  deployerAddress: string;
  ownerAddress: string;
  dprAddress: string;
  txHash: string;
  actualCost: bigint;
}

/**
 * Deploy Web3Site contracts across multiple chains with vanity addresses
 * @param chainIds - Array of chain IDs to deploy to
 * @param customDprAddresses - Optional custom DPR addresses per chain (if not provided, uses @tw3/esp addresses)
 * @param customDefaultHeader - Optional custom default header (if not provided, uses DEFAULT_HEADER)
 * @param skipVerification - Skip contract verification (optional, defaults to false)
 */
export async function deployWeb3SiteMultiChain(
  chainIds: number[],
  customDprAddresses?: Record<number, string>,
  customDefaultHeader?: typeof DEFAULT_HEADER,
  skipVerification: boolean = false
) {
  console.log("🚀 Starting multi-chain Web3Site vanity deployment...\n");
  
  if (chainIds.length === 0) {
    throw new Error("No chain IDs provided");
  }

  const defaultHeader = customDefaultHeader || DEFAULT_HEADER;
  
  console.log("📋 Multi-Chain Deployment Configuration:");
  console.log(`Target chains: ${chainIds.join(", ")}`);
  console.log(`Default header CORS methods: ${defaultHeader.cors.methods}`);
  console.log(`Cache preset: ${defaultHeader.cache.preset}`);
  console.log(`CORS preset: ${defaultHeader.cors.preset}\n`);

  // ========================================
  // STEP 1: Collect Network Information
  // ========================================
  
  interface NetworkInfo {
    chainId: number;
    provider: any;
    deployer: any;
    owner: any;
    nonce: number;
    balance: bigint;
    ownerBalance: bigint;
    gasPrice: bigint;
    dprAddress: string;
    shouldVerify: boolean;
  }

  const networks: NetworkInfo[] = [];
  const originalNetwork = hre.network.name;

  console.log("🔍 Collecting network information...");
  
  for (const chainId of chainIds) {
    // Find network name for this chain ID
    const networkName = Object.keys(hre.config.networks).find(name => {
      const network = hre.config.networks[name];
      return network && typeof network === 'object' && 'chainId' in network && network.chainId === chainId;
    });

    if (!networkName) {
      throw new Error(`No network configuration found for chain ID ${chainId}`);
    }

    // Switch to the target network
    hre.changeNetwork(networkName);
    
    const provider = hre.ethers.provider;
    const signers = await hre.ethers.getSigners();
    
    if (signers.length < 2) {
      throw new Error(`Network ${networkName} (${chainId}) needs at least 2 signers (deployer and owner)`);
    }

    const deployer = signers[0]; // Web3Site deployer
    const owner = signers[1]; // Owner for Web3Site contract

    const nonce = await provider.getTransactionCount(deployer.address);
    const balance = await provider.getBalance(deployer.address);
    const ownerBalance = await provider.getBalance(owner.address);
    const feeData = await provider.getFeeData();
    const gasPrice = feeData.gasPrice || parseUnits("20", "gwei");

    // Determine DPR address for this chain
    let dprAddress: string;
    if (customDprAddresses && customDprAddresses[chainId]) {
      dprAddress = customDprAddresses[chainId];
    } else {
      try {
        dprAddress = getContractAddress(chainId, "dpr");
      } catch (error) {
        throw new Error(`No DPR address available for chain ${chainId}. Please provide customDprAddresses or ensure @tw3/esp has this chain configured.`);
      }
    }

    const shouldVerify = chainId !== 31337 && chainId !== 1337 && !skipVerification;

    networks.push({
      chainId,
      provider,
      deployer,
      owner,
      nonce,
      balance,
      ownerBalance,
      gasPrice,
      dprAddress,
      shouldVerify
    });

    console.log(`📡 ${networkName} (${chainId}):`);
    console.log(`   Deployer: ${deployer.address} (nonce: ${nonce}, balance: ${formatEther(balance)} ETH)`);
    console.log(`   Owner: ${owner.address} (balance: ${formatEther(ownerBalance)} ETH)`);
    console.log(`   DPR: ${dprAddress}`);
    console.log(`   Gas price: ${formatEther(gasPrice * 1000000000n)} ETH/gas`);
    console.log(`   Verification: ${shouldVerify ? "ENABLED" : "DISABLED"}`);
  }

  // Switch back to original network
  hre.changeNetwork(originalNetwork);

  console.log("\n🔍 Validating nonce consistency...");
  
  // ========================================
  // STEP 2: Validate Nonce Consistency
  // ========================================
  
  const expectedNonce = networks[0].nonce;
  const nonceInconsistencies: string[] = [];

  for (const network of networks) {
    if (network.nonce !== expectedNonce) {
      nonceInconsistencies.push(
        `Chain ${network.chainId}: expected ${expectedNonce}, got ${network.nonce}`
      );
    }
  }

  if (nonceInconsistencies.length > 0) {
    console.error("❌ Nonce consistency check failed!");
    console.error("Deployer nonce mismatches:");
    nonceInconsistencies.forEach(msg => console.error(`   ${msg}`));
    throw new Error("Nonce consistency required for vanity multi-chain deployment. All deployers must have the same nonce.");
  }

  console.log(`✅ All deployers have consistent nonce: ${expectedNonce}`);
  
  if (expectedNonce > 0) {
    console.log(`⚠️  Note: Nonce is ${expectedNonce}, not 0. Deployment addresses will not be fully vanity.`);
  }

  // ========================================
  // STEP 3: Calculate Deployment Costs
  // ========================================
  
  console.log("\n💰 Estimating deployment costs across all chains...");
  
  const bufferMultiplier = 110n; // 110% (10% buffer)
  const divisor = 100n;
  
  interface DeploymentCost {
    chainId: number;
    gasEstimate: bigint;
    cost: bigint;
    balance: bigint;
    ownerBalance: bigint;
    needsFunding: boolean;
    fundingNeeded: bigint;
  }

  const deploymentCosts: DeploymentCost[] = [];
  let totalCost = 0n;
  let totalFundingNeeded = 0n;

  for (const network of networks) {
    // Switch to network to estimate gas
    const networkName = Object.keys(hre.config.networks).find(name => {
      const net = hre.config.networks[name];
      return net && typeof net === 'object' && 'chainId' in net && net.chainId === network.chainId;
    })!;
    
    hre.changeNetwork(networkName);
    
    const Web3SiteFactory = await hre.ethers.getContractFactory("Web3Site");
    const deployTx = await Web3SiteFactory.connect(network.deployer).getDeployTransaction(
      network.owner.address,
      network.dprAddress,
      defaultHeader,
    );
    
    const gasEstimate = await network.provider.estimateGas({
      ...deployTx,
      from: network.deployer.address
    });
    
    const cost = (gasEstimate * network.gasPrice * bufferMultiplier) / divisor;
    const needsFunding = network.balance < cost;
    const fundingNeeded = needsFunding ? cost - network.balance : 0n;
    
    deploymentCosts.push({
      chainId: network.chainId,
      gasEstimate,
      cost,
      balance: network.balance,
      ownerBalance: network.ownerBalance,
      needsFunding,
      fundingNeeded
    });
    
    totalCost += cost;
    totalFundingNeeded += fundingNeeded;
    
    console.log(`📊 Chain ${network.chainId}:`);
    console.log(`   Gas estimate: ${gasEstimate.toString()}`);
    console.log(`   Cost (with buffer): ${formatEther(cost)} ETH`);
    console.log(`   Deployer balance: ${formatEther(network.balance)} ETH`);
    console.log(`   Needs funding: ${needsFunding ? `${formatEther(fundingNeeded)} ETH` : "No"}`);
    
    if (needsFunding && network.ownerBalance < fundingNeeded) {
      throw new Error(`Chain ${network.chainId}: Insufficient funds. Deployer needs ${formatEther(fundingNeeded)} ETH but owner only has ${formatEther(network.ownerBalance)} ETH`);
    }
  }

  // Switch back to original network
  hre.changeNetwork(originalNetwork);

  console.log(`\n📈 Total estimated cost: ${formatEther(totalCost)} ETH`);
  if (totalFundingNeeded > 0n) {
    console.log(`💸 Total funding needed: ${formatEther(totalFundingNeeded)} ETH`);
  }

  // ========================================
  // STEP 4: Fund Deployers if Needed
  // ========================================
  
  if (totalFundingNeeded > 0n) {
    console.log("\n💰 Funding deployers...");
    
    for (let i = 0; i < networks.length; i++) {
      const network = networks[i];
      const cost = deploymentCosts[i];
      
      if (!cost.needsFunding) continue;
      
      const networkName = Object.keys(hre.config.networks).find(name => {
        const net = hre.config.networks[name];
        return net && typeof net === 'object' && 'chainId' in net && net.chainId === network.chainId;
      })!;
      
      hre.changeNetwork(networkName);
      
      console.log(`💸 Funding deployer on chain ${network.chainId}...`);
      console.log(`   Funding amount: ${formatEther(cost.fundingNeeded)} ETH`);
      
      const fundingTx = await network.owner.sendTransaction({
        to: network.deployer.address,
        value: cost.fundingNeeded,
        gasLimit: 21000n
      });
      
      await fundingTx.wait();
      console.log(`✅ Funded deployer on chain ${network.chainId} (tx: ${fundingTx.hash})`);
    }
    
    hre.changeNetwork(originalNetwork);
  }

  // ========================================
  // STEP 5: Deploy Contracts
  // ========================================
  
  console.log("\n🚀 Deploying Web3Site contracts across all chains...");
  
  const deployments: DeploymentResult[] = [];
  
  for (const network of networks) {
    const networkName = Object.keys(hre.config.networks).find(name => {
      const net = hre.config.networks[name];
      return net && typeof net === 'object' && 'chainId' in net && net.chainId === network.chainId;
    })!;
    
    hre.changeNetwork(networkName);
    
    console.log(`🚀 Deploying Web3Site on ${networkName} (${network.chainId})...`);
    
    const initialBalance = await network.provider.getBalance(network.deployer.address);
    
    const Web3SiteFactory = await hre.ethers.getContractFactory("Web3Site");
    const web3Site = await Web3SiteFactory.connect(network.deployer).deploy(
      network.owner.address,
      network.dprAddress,
      defaultHeader
    ) as Web3Site;
    
    await web3Site.waitForDeployment();
    const address = await web3Site.getAddress();
    const txHash = web3Site.deploymentTransaction()?.hash || "unknown";
    
    const finalBalance = await network.provider.getBalance(network.deployer.address);
    const actualCost = BigInt(initialBalance - finalBalance);
    
    deployments.push({
      chainId: network.chainId,
      networkName,
      contract: web3Site,
      address,
      deployerAddress: network.deployer.address,
      ownerAddress: network.owner.address,
      dprAddress: network.dprAddress,
      txHash,
      actualCost
    });
    
    console.log(`✅ Web3Site deployed on ${networkName}:`);
    console.log(`   Address: ${address}`);
    console.log(`   Transaction: ${txHash}`);
    console.log(`   Cost: ${formatEther(actualCost)} ETH`);
    
    // Test basic functionality
    try {
      console.log(`🧪 Testing Web3Site on ${networkName}...`);
      const dprFromSite = await web3Site.DPR();
      console.log(`   DPR address: ${dprFromSite}`);
      console.log(`   ✅ Contract functional`);
    } catch (error) {
      console.log(`   ❌ Contract test failed: ${error}`);
    }
  }

  // Switch back to original network
  hre.changeNetwork(originalNetwork);

  // ========================================
  // STEP 6: Verify Contracts
  // ========================================
  
  console.log("\n🔍 Verifying contracts...");
  
  for (const deployment of deployments) {
    if (!deployment || !networks.find(n => n.chainId === deployment.chainId)?.shouldVerify) {
      console.log(`⏭️  Skipping verification for chain ${deployment.chainId}`);
      continue;
    }
    
    hre.changeNetwork(deployment.networkName);
    
    try {
      console.log(`📋 Verifying Web3Site on ${deployment.networkName}...`);
      await hre.run("verify:verify", {
        address: deployment.address,
        constructorArguments: [
          deployment.ownerAddress,
          deployment.dprAddress,
          defaultHeader
        ],
      });
      console.log(`✅ Web3Site verified on ${deployment.networkName}`);
    } catch (error: any) {
      if (error.message.includes("Already Verified")) {
        console.log(`ℹ️  Web3Site already verified on ${deployment.networkName}`);
      } else {
        console.log(`❌ Web3Site verification failed on ${deployment.networkName}:`, error.message);
      }
    }
  }

  hre.changeNetwork(originalNetwork);

  // ========================================
  // STEP 7: Register Deployments
  // ========================================
  
  console.log("\n📝 Registering deployments...");
  
  for (const deployment of deployments) {
    try {
      const deploymentData = {
        chainId: deployment.chainId,
        contractAddress: deployment.address,
        deployerAddress: deployment.deployerAddress,
        txHash: deployment.txHash,
        deployedAt: new Date().toISOString(),
        constructors: {
          dprAddress: deployment.dprAddress,
          ownerAddress: deployment.ownerAddress,
          defaultHeader: defaultHeader
        }
      };
      
      // Note: You may need to adapt this to your site deployment registry format
      console.log(`📝 Registering deployment for chain ${deployment.chainId}...`);
      console.log(`   Address: ${deployment.address}`);
      console.log(`   ℹ️  Manual registration required - add to site.deployments.ts`);
    } catch (error: any) {
      console.log(`⚠️  Failed to register deployment for chain ${deployment.chainId}:`, error.message);
    }
  }

  // ========================================
  // STEP 8: Summary
  // ========================================
  
  const totalActualCost = deployments.reduce((sum, d) => sum + d.actualCost, 0n);
  
  console.log("\n🎉 Multi-chain deployment completed successfully!");
  console.log("\n📄 Deployment Summary:");
  console.log("=".repeat(80));
  console.log(`Chains deployed: ${deployments.length}`);
  console.log(`Expected nonce: ${expectedNonce}`);
  console.log(`Total actual cost: ${formatEther(totalActualCost)} ETH`);
  console.log("");
  
  deployments.forEach(deployment => {
    console.log(`${deployment.networkName} (${deployment.chainId}):`);
    console.log(`  Address: ${deployment.address}`);
    console.log(`  Owner: ${deployment.ownerAddress}`);
    console.log(`  DPR: ${deployment.dprAddress}`);
    console.log(`  Cost: ${formatEther(deployment.actualCost)} ETH`);
    console.log(`  TX: ${deployment.txHash}`);
  });
  
  console.log("=".repeat(80));

  return {
    deployments,
    totalCost: totalActualCost,
    networks: networks.map(n => ({ chainId: n.chainId, nonce: n.nonce }))
  };
}

// Legacy main function for direct script execution
async function main() {
  // Example usage - modify these for your needs
  const chainIds = [11155111, 80002]; // Sepolia and Polygon Amoy
  
  // Optional: specify custom DPR addresses per chain
  // const customDprAddresses = {
  //   11155111: "0x...", // Sepolia DPR
  //   80002: "0x..."     // Polygon Amoy DPR
  // };
  
  return await deployWeb3SiteMultiChain(
    chainIds,
    undefined, // Use default DPR addresses from @tw3/esp
    undefined, // Use default header
    false      // Enable verification
  );
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
