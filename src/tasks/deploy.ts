import { task, types } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";

task("site:deploy", "Deploy a single Web3Site contract with funding checks")
  .addOptionalParam(
    "dpr",
    "DataPointRegistry contract address (defaults to @tw3/esp address for current network)",
    undefined,
    types.string
  )
  .addOptionalParam(
    "owner",
    "Site owner address (defaults to signer[1] or deployer if only one signer)",
    undefined,
    types.string
  )
  .addOptionalParam(
    "cachePreset",
    "Cache preset (0=NONE, 1=NO_CACHE, 2=DEFAULT, 3=SHORT, 4=MEDIUM, 5=LONG, 6=PERMANENT) or (none|short|medium|long|aggressive|permanent)",
    "3",
    types.string
  )
  .addOptionalParam(
    "headerPreset",
    "Header preset (basic|development|production)",
    undefined,
    types.string
  )
  .addOptionalParam(
    "corsPreset", 
    "CORS preset (permissive|strict|basic)",
    undefined,
    types.string
  )
  .addFlag(
    "skipVerify",
    "Skip contract verification on block explorer"
  )
  .addFlag(
    "autoFund",
    "Automatically fund deployer from owner if needed"
  )
  .setAction(async (taskArgs, hre: HardhatRuntimeEnvironment) => {
    console.log(`🚀 Web3Site Deployment Task`);
    console.log(`🌐 Network: ${hre.network.name}\n`);

    const { dpr, owner, cachePreset, headerPreset, corsPreset, skipVerify, autoFund } = taskArgs;
    
    try {
      // Get signers
      const signers = await hre.ethers.getSigners();
      if (signers.length === 0) {
        throw new Error("No signers available");
      }

      const deployer = signers[0];
      const ownerAddress = owner || signers[0].address;

      console.log(`👤 Deployer: ${deployer.address}`);
      console.log(`👤 Owner: ${ownerAddress}`);

      // Get DPR address
      let dprAddress: string;
      if (dpr) {
        dprAddress = dpr;
        console.log(`📍 Using custom DPR: ${dprAddress}`);
      } else {
        const { getContractAddress } = await import("@tw3/esp");
        const chainId = hre.network.config.chainId;
        if (!chainId) {
          throw new Error("ChainId not configured");
        }
        
        // Add fallback for local testing
        if (hre.network.name === "hardhat" || hre.network.name === "localhost") {
          dprAddress = "0x0000000000000000000000000000000000000001"; // Test DPR address for local testing
          console.log(`📍 Using test DPR for local network: ${dprAddress}`);
        } else {
          dprAddress = getContractAddress(chainId, "dpr");
          console.log(`📍 Using @tw3/esp DPR: ${dprAddress}`);
        }
      }

      // Create default header - fixed to match contract requirements
      const defaultHeader = {
        cache: {
          immutableFlag: false,
          preset: cachePreset,
          custom: ""
        },
        cors: {
          methods: 511, // All methods allowed (9 bits for 9 methods)
          origins: [
            // Origins array must have 9 elements to match 9 methods (OPTIONS through DELETE)
            "0x0000000000000000000000000000000000000000000000000000000000000000", // PUBLIC role for all methods
            "0x0000000000000000000000000000000000000000000000000000000000000000",
            "0x0000000000000000000000000000000000000000000000000000000000000000",
            "0x0000000000000000000000000000000000000000000000000000000000000000",
            "0x0000000000000000000000000000000000000000000000000000000000000000",
            "0x0000000000000000000000000000000000000000000000000000000000000000",
            "0x0000000000000000000000000000000000000000000000000000000000000000",
            "0x0000000000000000000000000000000000000000000000000000000000000000",
            "0x0000000000000000000000000000000000000000000000000000000000000000"
          ],
          preset: 1, // PUBLIC preset
          custom: ""
        },
        redirect: {
          code: 0,
          location: ""
        }
      };

      console.log(`⚙️  Cache preset: ${cachePreset}`);

      // Named cache preset support (Alex's Phase 2 requirement)
      const cachePresets: { [key: string]: number } = { 
        none: 0, 
        short: 2, 
        medium: 3, 
        long: 4, 
        aggressive: 5, 
        permanent: 6 
      };

      // Convert string cache presets to numeric values
      const cacheValue = typeof cachePreset === 'string' 
        ? (cachePresets[cachePreset] !== undefined ? cachePresets[cachePreset] : parseInt(cachePreset)) 
        : cachePreset;

      console.log(`⚙️  Cache preset resolved: ${cacheValue} (from '${cachePreset}')`);

      // Apply header presets based on Alex's specifications
      const headerPresets: { [key: string]: { cache: number; cors: number } } = {
        basic: { cache: 3, cors: 1 },
        development: { cache: 1, cors: 2 }, 
        production: { cache: 5, cors: 0 }
      };

      const corsPresets: { [key: string]: number } = {
        permissive: 2,
        strict: 0,
        basic: 1
      };

      // Apply header preset if specified
      if (headerPreset && headerPresets[headerPreset]) {
        const preset = headerPresets[headerPreset];
        defaultHeader.cache.preset = preset.cache;
        defaultHeader.cors.preset = preset.cors;
        console.log(`🎛️  Applied header preset '${headerPreset}': cache=${preset.cache}, cors=${preset.cors}`);
      }

      // Apply CORS preset if specified (can override header preset)
      if (corsPreset && corsPresets[corsPreset]) {
        defaultHeader.cors.preset = corsPresets[corsPreset];
        console.log(`🌐 Applied CORS preset '${corsPreset}': cors=${corsPresets[corsPreset]}`);
      }

      // Apply cache preset (can override header preset)
      if (cacheValue !== undefined) {
        defaultHeader.cache.preset = cacheValue;
      }

      // Check balances and estimate costs
      const deployerBalance = await hre.ethers.provider.getBalance(deployer.address);
      const ownerBalance = await hre.ethers.provider.getBalance(signers[0].address);
      
      console.log(`💰 Deployer balance: ${hre.ethers.formatEther(deployerBalance)} ETH`);
      console.log(`💰 Owner balance: ${hre.ethers.formatEther(ownerBalance)} ETH`);

      // Estimate deployment cost
      const Web3SiteFactory = await hre.ethers.getContractFactory("Web3Site");
      const deployTx = await Web3SiteFactory.connect(deployer).getDeployTransaction(
        ownerAddress,
        dprAddress,
        defaultHeader
      );

      const gasEstimate = await hre.ethers.provider.estimateGas({
        ...deployTx,
        from: deployer.address
      });

      const feeData = await hre.ethers.provider.getFeeData();
      const gasPrice = feeData.gasPrice || hre.ethers.parseUnits("20", "gwei");
      const estimatedCost = gasEstimate * gasPrice * BigInt(110) / BigInt(100); // 10% buffer

      console.log(`⛽ Estimated cost: ${hre.ethers.formatEther(estimatedCost)} ETH (${gasEstimate.toString()} gas)`);

      // Check if funding is needed
      if (deployerBalance < estimatedCost) {
        const fundingNeeded = estimatedCost - deployerBalance;
        console.log(`⚠️  Deployer needs funding: ${hre.ethers.formatEther(fundingNeeded)} ETH`);

        if (!autoFund) {
          console.log(`💡 Run with --auto-fund to automatically fund from owner`);
          throw new Error("Insufficient deployer balance. Use --auto-fund or fund manually.");
        }

        if (ownerBalance < fundingNeeded) {
          throw new Error(`Owner has insufficient funds. Needed: ${hre.ethers.formatEther(fundingNeeded)} ETH, Available: ${hre.ethers.formatEther(ownerBalance)} ETH`);
        }

        console.log(`💸 Funding deployer with ${hre.ethers.formatEther(fundingNeeded)} ETH...`);
        const fundingTx = await signers[0].sendTransaction({
          to: deployer.address,
          value: fundingNeeded,
          gasLimit: 21000n
        });
        await fundingTx.wait();
        console.log(`✅ Funded deployer (tx: ${fundingTx.hash})`);
      }

      // Deploy Web3Site
      console.log(`🚀 Deploying Web3Site...`);
      const web3Site = await Web3SiteFactory.connect(deployer).deploy(
        ownerAddress,
        dprAddress,
        defaultHeader
      );

      await web3Site.waitForDeployment();
      const siteAddress = await web3Site.getAddress();
      const txHash = web3Site.deploymentTransaction()?.hash;

      console.log(`✅ Web3Site deployed successfully!`);
      console.log(`📍 Address: ${siteAddress}`);
      console.log(`🔗 Transaction: ${txHash}`);

      // Test contract
      try {
        const dprFromSite = await web3Site.DPR();
        console.log(`🧪 Contract test passed - DPR: ${dprFromSite}`);
      } catch (error) {
        console.log(`⚠️  Contract test failed: ${error}`);
      }

      // Verify if not skipped
      if (!skipVerify && hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
        console.log(`🔍 Verifying contract...`);
        try {
          await hre.run("verify:verify", {
            address: siteAddress,
            constructorArguments: [ownerAddress, dprAddress, defaultHeader],
          });
          console.log("✅ Contract verified!");
        } catch (error: any) {
          if (error.message.includes("Already Verified")) {
            console.log("ℹ️  Contract already verified");
          } else {
            console.log("❌ Verification failed:", error.message);
          }
        }
      }

      console.log("\n🎉 Deployment Summary:");
      console.log("=".repeat(50));
      console.log(`Web3Site: ${siteAddress}`);
      console.log(`Owner: ${ownerAddress}`);
      console.log(`DPR: ${dprAddress}`);
      console.log(`Transaction: ${txHash}`);
      console.log("=".repeat(50));

    } catch (error) {
      console.error("❌ Deployment failed:", error);
      process.exit(1);
    }
  });

task("deploy:multichain", "Deploy Web3Site contracts across multiple chains")
  .addParam(
    "chains",
    "Comma-separated list of chain IDs (e.g., '11155111,80002')",
    undefined,
    types.string
  )
  .addOptionalParam(
    "dprAddresses",
    "JSON object with DPR addresses per chain (e.g., '{\"11155111\":\"0x...\",\"80002\":\"0x...\"}')",
    undefined,
    types.string
  )
  .addOptionalParam(
    "cachePreset",
    "Cache preset (0=NONE, 1=NO_CACHE, 2=DEFAULT, 3=SHORT, 4=MEDIUM, 5=LONG, 6=PERMANENT)",
    "3",
    types.int
  )
  .addFlag(
    "skipVerify",
    "Skip contract verification on block explorer"
  )
  .setAction(async (taskArgs, hre) => {
    console.log(`🚀 Multi-Chain Web3Site Deployment Task\n`);

    const { chains, dprAddresses, cachePreset, skipVerify } = taskArgs;

    try {
      // Parse chain IDs
      const chainIds = chains.split(',').map((id: string) => parseInt(id.trim()));
      console.log(`🌐 Target chains: ${chainIds.join(', ')}`);

      // Parse custom DPR addresses if provided
      let customDprAddresses: Record<number, string> | undefined;
      if (dprAddresses) {
        customDprAddresses = JSON.parse(dprAddresses);
        console.log(`📍 Custom DPR addresses:`, customDprAddresses);
      }

      // Create custom header - updated to new structure
      const customHeader = {
        cache: {
          immutableFlag: false,
          preset: cachePreset,
          custom: ""
        },
        cors: {
          methods: 511,
          origins: [],
          preset: 1, // PUBLIC preset
          custom: ""
        },
        redirect: {
          code: 0,
          location: ""
        }
      };

      // Import and run multi-chain deployment
      const { deployWeb3SiteMultiChain } = await import("../scripts/DeployMultiChain");
      
      const result = await deployWeb3SiteMultiChain(
        chainIds,
        customDprAddresses,
        customHeader,
        skipVerify
      );

      console.log("\n🎉 Multi-Chain Deployment Complete!");
      return result;

    } catch (error) {
      console.error("❌ Multi-chain deployment failed:", error);
      process.exit(1);
    }
  });

task("deploy:verify", "Verify deployed Web3Site contract")
  .addParam("address", "Web3Site contract address", undefined, types.string)
  .addParam("dpr", "DPR address used in constructor", undefined, types.string)
  .addParam("owner", "Owner address used in constructor", undefined, types.string)
  .addOptionalParam("maxAge", "Cache max age used in constructor", "3600", types.int)
  .setAction(async (taskArgs, hre) => {
    const { address, dpr, owner, maxAge } = taskArgs;

    console.log(`🔍 Verifying Web3Site on ${hre.network.name}...`);
    console.log(`📍 Contract: ${address}`);

    const defaultHeader = {
      methods: 511,
      cache: {
        maxAge: parseInt(maxAge),
        noStore: false,
        noCache: false,
        immutableFlag: false,
        publicFlag: true
      },
      redirect: {
        code: 0,
        location: ""
      },
      resourceAdmin: hre.ethers.ZeroHash
    };

    try {
      await hre.run("verify:verify", {
        address: address,
        constructorArguments: [owner, dpr, defaultHeader],
      });
      console.log("✅ Web3Site verified successfully!");
    } catch (error: any) {
      if (error.message.includes("Already Verified")) {
        console.log("ℹ️  Web3Site already verified");
      } else {
        console.error("❌ Verification failed:", error);
        process.exit(1);
      }
    }
  });

export default {};