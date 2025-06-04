/**
 * WTTP Site - Deployment Registry
 * 
 * This file tracks all WTTP Site contract deployments across different networks.
 * Used for reference, integration, and deployment management.
 * 
 * @version 0.2.0
 * @license AGPL-3.0
 */

/**
 * WTTP Site Deployments - Simple Contract Registry
 * Tracks deployed contract addresses and deployment info organized by site
 * Sites may have deployments across multiple chains
 */

export const siteDeployments = {
    sites: {
        "site1": {
            chains: {
                11155111: {
                    contractAddress: '0xDA7A6cBEa6113fae8C55165e354bCab49b0923cE',
                    deployerAddress: '0xb37Be4AFc1d210c662E8F05FC0AaEd4EddDD809E',
                    txHash: '0x2c30246bb7b7db7cd9d0d147103b2793b660e08110aa2690de727ae49b7e1a93',
                    deployedAt: '2025-05-31T18:59:12.000Z',
                    constructors: {
                        ownerAddress: '0xDA00006427E534B1Acde93B9E66d8A9d2C66B2d3',
                        dpsAddress: '0xDA7A3A73d3bAf09AE79Bac612f03B4c0d51859dB',
                        royaltyRate: '1000000000000000'
                    }
                }
            }
        }
    }
};

export default siteDeployments; 