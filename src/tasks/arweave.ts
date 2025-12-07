import { task, types } from "hardhat/config";
import fs from "fs";
import path from "path";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { ManifestConfig } from "../ethers/generateManifest";
import Arweave from "arweave";
import type { JWKInterface } from "arweave/node/lib/wallet";

task("arweave:upload", "Upload site resources to Arweave using official Arweave library")
  .addOptionalParam(
    "manifestPath",
    "Path to an existing manifest file",
    undefined,
    types.string
  )
  .addOptionalParam(
    "source",
    "Source directory path (required if generating manifest from config)",
    undefined,
    types.string
  )
  .addOptionalParam(
    "wallet",
    "Path to Arweave wallet JSON file (JWK format)",
    undefined,
    types.string
  )
  .addOptionalParam(
    "externalrules",
    "JSON file path containing external storage rules (for manifest generation)",
    undefined,
    types.string
  )
  .addOptionalParam(
    "gaslimit",
    "Maximum gas price in gwei (for manifest generation)",
    undefined,
    types.float
  )
  .addOptionalParam(
    "filelimit",
    "Maximum file size in MB (for manifest generation)",
    undefined,
    types.float
  )
  .addOptionalParam(
    "ignorepattern",
    "Custom ignore pattern file path or 'none' (for manifest generation)",
    undefined,
    types.string
  )
  .addOptionalParam(
    "output",
    "Output path for manifest file (when generating)",
    undefined,
    types.string
  )
  .addFlag(
    "uploadManifest",
    "Upload the manifest itself to Arweave after updating"
  )
  .setAction(async (taskArgs, hre: HardhatRuntimeEnvironment) => {
    const {
      manifestPath,
      source,
      wallet,
      externalrules,
      gaslimit,
      filelimit,
      ignorepattern,
      output,
      uploadManifest,
    } = taskArgs;

    const { uploadToArweave } = await import("../scripts/uploadToArweave");
    const { loadManifest, saveManifest, generateManifestStandalone } = await import("../ethers/generateManifest");

    console.log(`🌐 Arweave Upload Task`);
    console.log(`🌐 Network: ${hre.network.name}\n`);

    // Validate wallet
    if (!wallet) {
      throw new Error("--wallet parameter is required. Provide path to Arweave wallet JSON file.");
    }

    if (!fs.existsSync(wallet)) {
      throw new Error(`Arweave wallet file not found: ${wallet}`);
    }

    let finalManifestPath: string;
    let sourcePath: string;

    // Determine if we're using existing manifest or generating new one
    if (manifestPath) {
      // Use existing manifest
      if (!fs.existsSync(manifestPath)) {
        throw new Error(`Manifest file not found: ${manifestPath}`);
      }

      finalManifestPath = manifestPath;
      
      // Try to determine source path from manifest location
      const manifestDir = path.dirname(manifestPath);
      const manifest = loadManifest(manifestPath);
      
      // Use provided source or try to infer from manifest
      sourcePath = source || manifestDir;
      
      console.log(`📋 Using existing manifest: ${manifestPath}`);
      console.log(`📁 Source directory: ${sourcePath}`);
    } else if (source) {
      // Generate new manifest
      if (!fs.existsSync(source)) {
        throw new Error(`Source directory does not exist: ${source}`);
      }

      sourcePath = source;

      // Build manifest config
      const config: ManifestConfig = {};

      if (gaslimit !== undefined) {
        config.gasLimit = parseFloat(gaslimit);
      }

      if (filelimit !== undefined) {
        config.fileLimit = parseFloat(filelimit);
      }

      if (ignorepattern) {
        if (ignorepattern === "none") {
          config.ignorePattern = "none";
        } else {
          config.ignorePattern = ignorepattern;
        }
      }

      // Load external storage rules if provided
      if (externalrules) {
        if (!fs.existsSync(externalrules)) {
          throw new Error(`External rules file not found: ${externalrules}`);
        }

        try {
          const rulesJson = fs.readFileSync(externalrules, "utf-8");
          const rules = JSON.parse(rulesJson);
          config.externalStorageRules = rules;
          console.log(`📦 Loaded ${rules.length} external storage rules`);
        } catch (error) {
          throw new Error(`Failed to parse external rules JSON: ${error}`);
        }
      }

      // Determine output path
      const outputPath = output || path.join(source, "wttp.manifest.json");

      console.log(`📋 Generating manifest for: ${source}`);
      console.log(`📁 Output: ${outputPath}`);

      // Generate manifest
      const manifest = await generateManifestStandalone(
        source,
        "/",
        Object.keys(config).length > 0 ? config : undefined
      );

      finalManifestPath = path.resolve(outputPath);
      const manifestDir = path.dirname(finalManifestPath);
      
      // Save manifest
      saveManifest(manifest, finalManifestPath);

      console.log(`✅ Manifest generated: ${finalManifestPath}`);
    } else {
      throw new Error(
        "Either --manifestPath or --source must be provided.\n" +
        "  --manifestPath: Use existing manifest file\n" +
        "  --source: Generate new manifest from directory"
      );
    }

    // Upload to Arweave
    console.log(`\n🚀 Starting Arweave upload...`);
    
    const result = await uploadToArweave(finalManifestPath, {
      walletPath: wallet,
      sourcePath: sourcePath,
      uploadManifest: uploadManifest,
    });

    console.log(`\n✅ Arweave upload task complete!`);
    console.log(`   Files uploaded: ${result.filesUploaded}`);
    console.log(`   Files skipped: ${result.filesSkipped}`);
    
    if (result.manifestTxId) {
      console.log(`   Manifest TXID: ${result.manifestTxId}`);
    }

    console.log(`\n📋 Updated manifest saved to: ${finalManifestPath}`);
    
    if (result.filesUploaded > 0) {
      console.log(`\n💡 Next steps:`);
      console.log(`   1. Review the updated manifest`);
      console.log(`   2. Upload redirects to your WTTP site using site:upload`);
    }
  });

task("arweave:generate", "Generate a new Arweave wallet and save to file")
  .addOptionalParam(
    "output",
    "Output filename for the wallet JSON file",
    "wallet.json",
    types.string
  )
  .addFlag(
    "force",
    "Force overwrite existing wallet file (with balance check and warning)"
  )
  .setAction(async (taskArgs, hre: HardhatRuntimeEnvironment) => {
    const { output, force } = taskArgs;

    console.log(`🔑 Generating Arweave wallet...`);

    // Initialize Arweave
    const arweave = Arweave.init({
      host: "arweave.net",
      port: 443,
      protocol: "https",
    });

    try {
      // Generate new wallet
      const key = await arweave.wallets.generate();
      
      // Get address from the key
      const address = await arweave.wallets.jwkToAddress(key);

      // Determine output path
      const outputPath = path.resolve(output);

      // Check if file already exists
      if (fs.existsSync(outputPath)) {
        if (!force) {
          throw new Error(
            `Wallet file already exists: ${outputPath}\n` +
            `If you want to overwrite it, use the --force flag.\n` +
            `⚠️  WARNING: Overwriting will permanently delete the existing wallet!`
          );
        }

        // Force mode: check balance of existing wallet before overwriting
        console.log(`⚠️  Force mode enabled - existing wallet will be overwritten!`);
        console.log(`📋 Checking balance of existing wallet...`);

        try {
          // Load existing wallet
          const existingWalletKey: JWKInterface = JSON.parse(fs.readFileSync(outputPath, "utf-8"));
          const existingAddress = await arweave.wallets.jwkToAddress(existingWalletKey);
          const balanceWinston = await arweave.wallets.getBalance(existingAddress);
          const balanceAr = arweave.ar.winstonToAr(balanceWinston);

          console.log(`   Address: ${existingAddress}`);
          console.log(`   Balance: ${balanceAr} AR (${balanceWinston} Winston)`);

          if (parseFloat(balanceWinston) > 0) {
            console.log(`\n🚨 ⚠️  ⚠️  ⚠️  CRITICAL WARNING ⚠️  ⚠️  ⚠️  🚨`);
            console.log(`\n   The existing wallet has a NON-ZERO balance!`);
            console.log(`   Address: ${existingAddress}`);
            console.log(`   Balance: ${balanceAr} AR`);
            console.log(`\n   ⚠️  OVERWRITING THIS WALLET WILL PERMANENTLY DELETE IT!`);
            console.log(`   ⚠️  YOU WILL LOSE ACCESS TO ${balanceAr} AR!`);
            console.log(`   ⚠️  THIS CANNOT BE UNDONE!`);
            console.log(`\n   You have 10 seconds to cancel (Ctrl+C)...\n`);

            // Countdown with warnings
            for (let i = 10; i > 0; i--) {
              process.stdout.write(`\r   ⏱️  Continuing in ${i} seconds... (Press Ctrl+C to cancel)   `);
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
            console.log(`\n\n   ⚠️  Proceeding with wallet overwrite...\n`);
          } else {
            console.log(`\n   ℹ️  Existing wallet has zero balance - safe to overwrite.`);
          }
        } catch (error: any) {
          console.warn(`   ⚠️  Could not check existing wallet balance: ${error.message}`);
          console.warn(`   Proceeding with overwrite anyway...`);
        }
      }

      // Ensure directory exists
      const outputDir = path.dirname(outputPath);
      if (outputDir !== "." && !fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // Check and update .gitignore
      const gitignorePath = path.resolve(".gitignore");
      if (fs.existsSync(gitignorePath)) {
        const gitignoreContent = fs.readFileSync(gitignorePath, "utf-8");
        const gitignoreLines = gitignoreContent.split("\n").map(line => line.trim());
        
        // Get relative path from workspace root for gitignore
        const workspaceRoot = process.cwd();
        const relativeOutputPath = path.relative(workspaceRoot, outputPath).replace(/\\/g, "/");
        
        // Check if the file or a matching pattern is already in .gitignore
        const filename = path.basename(relativeOutputPath);
        const isIgnored = gitignoreLines.some(line => {
          // Skip empty lines and comments
          if (!line || line.startsWith("#")) return false;
          
          // Check for exact match
          if (line === relativeOutputPath || line === filename) return true;
          
          // Check for wildcard patterns (simple check)
          if (line.includes("*")) {
            // Convert gitignore pattern to regex-like check
            const pattern = line.replace(/\*/g, ".*");
            try {
              const regex = new RegExp(`^${pattern}$`);
              if (regex.test(relativeOutputPath) || regex.test(filename)) {
                return true;
              }
            } catch {
              // Invalid regex, skip
            }
          }
          
          return false;
        });
        
        if (!isIgnored) {
          // Add to .gitignore
          const newEntry = `\n# Arweave wallet file\n${relativeOutputPath}\n`;
          fs.appendFileSync(gitignorePath, newEntry);
          console.log(`📝 Added ${relativeOutputPath} to .gitignore`);
        }
      } else {
        // Create .gitignore if it doesn't exist
        const relativeOutputPath = path.relative(process.cwd(), outputPath).replace(/\\/g, "/");
        fs.writeFileSync(gitignorePath, `# Arweave wallet file\n${relativeOutputPath}\n`);
        console.log(`📝 Created .gitignore and added ${relativeOutputPath}`);
      }

      // Save wallet to file
      fs.writeFileSync(outputPath, JSON.stringify(key, null, 2));

      console.log(`✅ Wallet generated successfully!`);
      console.log(`   Address: ${address}`);
      console.log(`   Saved to: ${outputPath}`);
      console.log(`\n⚠️  WARNING: Keep this file secure! Anyone with access to this file can control the wallet.`);
      console.log(`   Never commit this file to version control.`);
    } catch (error: any) {
      console.error(`❌ Failed to generate wallet:`, error.message);
      throw error;
    }
  });

task("arweave:address", "Get the Arweave address from a wallet file")
  .addOptionalParam(
    "wallet",
    "Path to Arweave wallet JSON file (JWK format)",
    "wallet.json",
    types.string
  )
  .setAction(async (taskArgs, hre: HardhatRuntimeEnvironment) => {
    const { wallet } = taskArgs;

    console.log(`🔍 Getting address from wallet...`);

    // Validate wallet file
    if (!fs.existsSync(wallet)) {
      throw new Error(`Wallet file not found: ${wallet}, to generate a new wallet, run "npx hardhat arweave:generate --output ${wallet}"`);
    }

    try {
      // Initialize Arweave
      const arweave = Arweave.init({
        host: "arweave.net",
        port: 443,
        protocol: "https",
      });

      // Load wallet
      const walletKey: JWKInterface = JSON.parse(fs.readFileSync(wallet, "utf-8"));

      // Get address
      const address = await arweave.wallets.jwkToAddress(walletKey);

      console.log(`✅ Wallet address: ${address}`);
      return address;
    } catch (error: any) {
      console.error(`❌ Failed to get address:`, error.message);
      throw error;
    }
  });

task("arweave:balance", "Get the balance of an Arweave wallet or address")
  .addOptionalParam(
    "wallet",
    "Path to Arweave wallet JSON file (JWK format)",
    "wallet.json",
    types.string
  )
  .addOptionalParam(
    "address",
    "Arweave address to check balance",
    undefined,
    types.string
  )
  .setAction(async (taskArgs, hre: HardhatRuntimeEnvironment) => {
    const { wallet, address: addressParam } = taskArgs;

    try {
      // Initialize Arweave
      const arweave = Arweave.init({
        host: "arweave.net",
        port: 443,
        protocol: "https",
      });

      // If both wallet and address are provided, validate they match
      if (addressParam && fs.existsSync(wallet)) {
        const walletKey: JWKInterface = JSON.parse(fs.readFileSync(wallet, "utf-8"));
        const walletAddress = await arweave.wallets.jwkToAddress(walletKey);
        
        if (walletAddress !== addressParam) {
          throw new Error(
            `Wallet address mismatch!\n` +
            `  Wallet file: ${wallet}\n` +
            `  Wallet address: ${walletAddress}\n` +
            `  Provided address: ${addressParam}\n` +
            `These addresses do not match. Please provide either --wallet or --address, not both with mismatched values.`
          );
        }
      }

      // If address is provided, use it; otherwise use wallet (defaults to wallet.json)
      const useWallet = !addressParam;

      let address: string;

      if (useWallet) {
        // Validate wallet file
        if (!fs.existsSync(wallet)) {
          throw new Error(`Wallet file not found: ${wallet}, to generate a new wallet, run "npx hardhat arweave:generate --output ${wallet}"`);
        }

        // Load wallet and get address
        const walletKey: JWKInterface = JSON.parse(fs.readFileSync(wallet, "utf-8"));
        address = await arweave.wallets.jwkToAddress(walletKey);
        console.log(`🔍 Wallet address: ${address}`);
      } else {
        address = addressParam!;
        console.log(`🔍 Checking balance for address: ${address}`);
      }

      // Get balance
      const balanceWinston = await arweave.wallets.getBalance(address);
      const balanceAr = arweave.ar.winstonToAr(balanceWinston);

      console.log(`\n💰 Balance:`);
      console.log(`   Winston: ${balanceWinston}`);
      console.log(`   AR: ${balanceAr}`);

      return {
        address,
        winston: balanceWinston,
        ar: balanceAr,
      };
    } catch (error: any) {
      console.error(`❌ Failed to get balance:`, error.message);
      throw error;
    }
  });

task("arweave:send", "Send AR tokens from a wallet to an address")
  .addParam(
    "wallet",
    "Path to Arweave wallet JSON file (JWK format)",
    undefined,
    types.string
  )
  .addParam(
    "to",
    "Destination Arweave address",
    undefined,
    types.string
  )
  .addParam(
    "amount",
    "Amount to send in AR (not Winston)",
    undefined,
    types.string
  )
  .addFlag(
    "self",
    "Allow sending to the same address (for testing/debugging)"
  )
  .setAction(async (taskArgs, hre: HardhatRuntimeEnvironment) => {
    const { wallet, to, amount, self } = taskArgs;

    console.log(`💸 Sending AR transaction...`);

    // Validate wallet file
    if (!fs.existsSync(wallet)) {
      throw new Error(`Wallet file not found: ${wallet}`);
    }

    // Validate amount
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      throw new Error(`Invalid amount: ${amount}. Must be a positive number.`);
    }

    try {
      // Initialize Arweave
      const arweave = Arweave.init({
        host: "arweave.net",
        port: 443,
        protocol: "https",
      });

      // Load wallet
      const walletKey: JWKInterface = JSON.parse(fs.readFileSync(wallet, "utf-8"));
      const fromAddress = await arweave.wallets.jwkToAddress(walletKey);

      console.log(`   From: ${fromAddress}`);
      console.log(`   To: ${to}`);
      console.log(`   Amount: ${amount} AR`);

      // Check for self-send
      if (fromAddress === to && !self) {
        throw new Error(
          `Cannot send to the same address (${fromAddress}).\n` +
          `If you intended to send to yourself for testing or debugging, use the --self flag.`
        );
      }

      // Convert AR to Winston
      const amountWinston = arweave.ar.arToWinston(amount);

      // Create transaction
      const transaction = await arweave.createTransaction({
        target: to,
        quantity: amountWinston,
      }, walletKey);

      // Sign transaction
      await arweave.transactions.sign(transaction, walletKey);

      console.log(`\n📝 Transaction created:`);
      console.log(`   ID: ${transaction.id}`);
      console.log(`   Format: ${transaction.format}`);
      console.log(`   Quantity: ${transaction.quantity} Winston (${amount} AR)`);
      console.log(`   Reward: ${transaction.reward} Winston`);

      // Submit transaction
      console.log(`\n📤 Submitting transaction...`);
      const response = await arweave.transactions.post(transaction);

      if (response.status === 200 || response.status === 208) {
        console.log(`✅ Transaction submitted successfully!`);
        console.log(`   Transaction ID: ${transaction.id}`);
        console.log(`   Status: ${response.status === 208 ? "Already posted" : "Posted"}`);
        console.log(`\n💡 You can view the transaction at:`);
        console.log(`   https://viewblock.io/arweave/tx/${transaction.id}`);
      } else {
        throw new Error(`Failed to submit transaction. Status: ${response.status}`);
      }

      return {
        txId: transaction.id,
        from: fromAddress,
        to,
        amount: amount,
        amountWinston: transaction.quantity,
      };
    } catch (error: any) {
      console.error(`❌ Failed to send transaction:`, error.message);
      throw error;
    }
  });

export default {};

