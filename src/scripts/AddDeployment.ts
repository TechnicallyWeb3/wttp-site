import fs from 'fs';
import path from 'path';

interface SiteDeploymentData {
  siteName: string;
  chainId: number;
  site: {
    contractAddress: string;
    deployerAddress: string;
    txHash?: string;
    constructors: {
      ownerAddress: string;
      dpsAddress: string;
      royaltyRate: string; // in wei
    };
  };
}

/**
 * Add a new deployment to the WTTP Site deployment registry with enhanced validation
 */
export async function addSiteDeployment(deploymentData: SiteDeploymentData): Promise<void> {
  // Parameter validation
  if (!deploymentData) {
    throw new Error("Deployment data is required");
  }
  if (!deploymentData.siteName || !deploymentData.chainId || !deploymentData.site) {
    throw new Error("Invalid deployment data: siteName, chainId, and site are required");
  }
  if (!deploymentData.site.contractAddress) {
    throw new Error("Contract address is required");
  }

  // Skip hardhat chain with better logging
  if (deploymentData.chainId === 31337) {
    console.log(`🚫 Skipping deployment registry update for local testing chain (${deploymentData.chainId})`);
    return;
  }

  console.log(`📝 Adding deployment to registry: ${deploymentData.siteName} on chain ${deploymentData.chainId}`);
  const registryPath = path.join(__dirname, '..', 'site.deployments.ts');
  
  // Validate registry file exists
  if (!fs.existsSync(registryPath)) {
    throw new Error(`Registry file not found: ${registryPath}`);
  }
  
  try {
    // Read current registry
    let registryContent = fs.readFileSync(registryPath, 'utf8');
    
    const timestamp = new Date().toISOString();
    
    // Build the new chain deployment entry for this site
    const chainDeployment = `        ${deploymentData.chainId}: {
          contractAddress: '${deploymentData.site.contractAddress}',
          deployerAddress: '${deploymentData.site.deployerAddress}',
          txHash: '${deploymentData.site.txHash || 'TBD'}',
          deployedAt: '${timestamp}',
          constructors: {
            ownerAddress: '${deploymentData.site.constructors.ownerAddress}',
            dpsAddress: '${deploymentData.site.constructors.dpsAddress}',
            royaltyRate: '${deploymentData.site.constructors.royaltyRate}'
          }
        }`;

    // Check if site already exists
    const siteRegex = new RegExp(`"${deploymentData.siteName}":\\s*{[^}]*(?:}[^}]*)*}`, 's');
    
    if (registryContent.match(siteRegex)) {
      // Site exists, check if this chain already exists for this site
      const siteMatch = registryContent.match(siteRegex);
      if (siteMatch) {
        const siteContent = siteMatch[0];
        const chainRegex = new RegExp(`${deploymentData.chainId}:\\s*{[^}]*(?:}[^}]*)*}`, 's');
        
        if (siteContent.match(chainRegex)) {
          // Chain exists, replace deployment
          const updatedSiteContent = siteContent.replace(chainRegex, chainDeployment.trim());
          registryContent = registryContent.replace(siteRegex, updatedSiteContent);
          console.log(`📝 Updated existing ${deploymentData.siteName} deployment on chain ${deploymentData.chainId}`);
        } else {
          // Chain doesn't exist, add it to the site
          // Find the closing brace of the chains object within this site
          const chainsPattern = new RegExp(`("${deploymentData.siteName}":\\s*{[^}]*chains:\\s*{)([^}]*(?:}[^}]*)*)(}[^}]*})`, 's');
          const chainsMatch = registryContent.match(chainsPattern);
          
          if (chainsMatch) {
            const beforeChains = chainsMatch[1];
            const existingChains = chainsMatch[2];
            const afterChains = chainsMatch[3];
            
            // Check if we need a comma
            const hasExistingChains = existingChains.trim() && 
                                    existingChains.includes(':') && 
                                    existingChains.trim() !== '';
            
            const comma = hasExistingChains ? ',\n' : '\n';
            const newContent = beforeChains + existingChains + comma + chainDeployment + '\n      ' + afterChains;
            
            registryContent = registryContent.replace(chainsPattern, newContent);
            console.log(`📝 Added chain ${deploymentData.chainId} deployment to existing site ${deploymentData.siteName}`);
          } else {
            throw new Error(`Could not find chains object for site ${deploymentData.siteName}`);
          }
        }
      }
    } else {
      // Site doesn't exist, create new site entry
      const newSiteEntry = `      "${deploymentData.siteName}": {
        chains: {
          ${chainDeployment}
        }
      }`;

      // Find the sites object and add the new site
      const sitesPattern = /sites:\s*{([^}]*(?:}[^}]*)*)}([^}]*}[^}]*$)/s;
      const sitesMatch = registryContent.match(sitesPattern);
      
      if (sitesMatch) {
        const existingSites = sitesMatch[1];
        const afterSites = sitesMatch[2];
        
        // Check if we need a comma
        const hasExistingSites = existingSites.trim() && 
                               existingSites.includes(':') && 
                               existingSites.trim() !== '';
        
        const comma = hasExistingSites ? ',\n' : '\n';
        const newContent = `sites: {${existingSites}${comma}${newSiteEntry}\n    }${afterSites}`;
        
        registryContent = registryContent.replace(sitesPattern, newContent);
        console.log(`📝 Added new site ${deploymentData.siteName} with chain ${deploymentData.chainId} deployment`);
      } else {
        throw new Error('Could not find sites object in registry file');
      }
    }
    
    // Write back to file
    fs.writeFileSync(registryPath, registryContent, 'utf8');
    console.log(`✅ Site deployment registry updated successfully`);
    
  } catch (error) {
    console.error(`❌ Failed to update site deployment registry:`, error);
    throw error;
  }
}

/**
 * Quick helper to format site deployment data from deploy script results
 */
export function formatSiteDeploymentData(
  siteName: string,
  chainId: number,
  siteResult: { 
    address: string; 
    deployerAddress: string; 
    txHash?: string;
    owner: string;
    dpsAddress: string;
    royaltyRate: bigint;
  }
): SiteDeploymentData {
  return {
    siteName,
    chainId,
    site: {
      contractAddress: siteResult.address,
      deployerAddress: siteResult.deployerAddress,
      txHash: siteResult.txHash,
      constructors: {
        ownerAddress: siteResult.owner,
        dpsAddress: siteResult.dpsAddress,
        royaltyRate: siteResult.royaltyRate.toString()
      }
    }
  };
}

// Legacy exports for backward compatibility
export const addDeployment = addSiteDeployment;
export const formatDeploymentData = formatSiteDeploymentData;