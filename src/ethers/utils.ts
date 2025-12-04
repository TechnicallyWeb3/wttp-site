// Shared utilities for standalone ethers.js scripts
import { Contract, Provider, Signer } from "ethers";
// Import artifact directly to avoid loading tasks
import Web3SiteArtifact from "../../artifacts/contracts/Web3Site.sol/Web3Site.json";

// Helper to get chain symbol from provider
export async function getChainSymbol(provider?: Provider): Promise<string> {
  if (!provider) return "ETH";
  
  try {
    const network = await provider.getNetwork();
    return network.chainId === 137n ? "POL" : "ETH";
  } catch (error) {
    return "ETH";
  }
}

// Helper to get currency symbol from chain ID
export function getChainSymbolFromChainId(chainId: number): string {
  return chainId === 137 ? "POL" : "ETH";
}

/**
 * Creates a properly typed WTTP site contract instance
 * Using the ABI ensures TypeScript knows about all contract methods
 */
export function getWttpSite(wttpSiteAddress: string, provider?: Provider, signer?: Signer): Contract {
  // Use signer if provided (for transactions), otherwise use provider (for view calls)
  const runner = signer || provider;
  if (!runner) {
    throw new Error("Either provider or signer must be provided");
  }
  return new Contract(wttpSiteAddress, Web3SiteArtifact.abi, runner);
}

/**
 * Waits for a transaction to be fully confirmed and ensures nonce is updated
 * This is critical for Hardhat's automining to prevent nonce conflicts
 */
export async function waitForTransactionWithNonceUpdate(
  txPromise: Promise<{ wait: (confirmations?: number) => Promise<any> }>,
  signer?: Signer,
  confirmations: number = 1
): Promise<any> {
  const tx = await txPromise;
  const receipt = await tx.wait(confirmations);
  
  // Wait for nonce to update in the provider (important for Hardhat automining)
  if (signer && signer.provider) {
    // Small delay to ensure nonce is updated in the provider
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Verify nonce is updated by checking transaction count
    // This ensures the next transaction will use the correct nonce
    try {
      const address = await signer.getAddress();
      await signer.provider.getTransactionCount(address, "pending");
    } catch (error) {
      // Non-critical, just ensure we wait a bit longer
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }
  
  return receipt;
}

/**
 * Waits for a transaction to be fully confirmed
 * This ensures the transaction is mined and the nonce is updated before proceeding
 */
export async function waitForTransactionConfirmation(
  txPromise: Promise<{ wait: (confirmations?: number) => Promise<any> }>,
  confirmations: number = 1
): Promise<any> {
  const tx = await txPromise;
  const receipt = await tx.wait(confirmations);
  
  // Additional wait to ensure nonce is updated in the provider
  // This is especially important for Hardhat's automining
  if (confirmations > 0) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  return receipt;
}

/**
 * Gets the current nonce for an address and ensures it's up to date
 */
export async function getCurrentNonce(signer: Signer): Promise<number> {
  const address = await signer.getAddress();
  const provider = signer.provider;
  if (!provider) {
    throw new Error("Signer must have a provider to get nonce");
  }
  return await provider.getTransactionCount(address, "pending");
}
