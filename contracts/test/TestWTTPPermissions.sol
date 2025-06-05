// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.20;

import "../WTTPPermissions.sol";

/// @title Test WTTP Permissions Contract
/// @notice Concrete implementation of the WTTPPermissions abstract contract for testing
/// @dev Provides a deployable implementation of the WTTP permissions system with full debugging access
contract TestWTTPPermissions is WTTPPermissions {

    /// @notice Initializes the permissions contract with an owner
    /// @dev Sets up roles and permissions, then passes to parent constructor
    /// @param _owner Address that will receive the DEFAULT_ADMIN_ROLE
    constructor(address _owner) WTTPPermissions(_owner) {}

    // ========== Exposed Internal Variables ==========
    
    /// @notice Public getter for the SITE_ADMIN_ROLE variable
    /// @return bytes32 The site admin role identifier
    function getSiteAdminRole() external view returns (bytes32) {
        return SITE_ADMIN_ROLE;
    }

    /// @notice Public getter for the PUBLIC_ROLE variable
    /// @return bytes32 The public role identifier
    function getPublicRole() external view returns (bytes32) {
        return PUBLIC_ROLE;
    }

    // ========== Exposed Internal Modifiers ==========
    
    /// @notice Public wrapper to test the notAdminRole modifier
    /// @param _role Role to test the modifier with
    function testNotAdminRoleModifier(bytes32 _role) external view notAdminRole(_role) {
        // This function will revert if _role is an admin role
    }

    // ========== Direct Access to Internal State ==========
    
    /// @notice Public setter for SITE_ADMIN_ROLE for testing purposes
    /// @dev Allows direct manipulation of the role for debugging
    /// @param _newRole The new site admin role identifier
    function setSiteAdminRoleForTesting(bytes32 _newRole) external {
        SITE_ADMIN_ROLE = _newRole;
    }

    /// @notice Public setter for PUBLIC_ROLE for testing purposes
    /// @dev Allows direct manipulation of the role for debugging
    /// @param _newRole The new public role identifier
    function setPublicRoleForTesting(bytes32 _newRole) external {
        PUBLIC_ROLE = _newRole;
    }

    // ========== Test Helper Functions ==========
    
    /// @notice Check if a role is considered an admin role by the notAdminRole modifier
    /// @param _role The role to check
    /// @return bool True if the role would trigger the notAdminRole modifier
    function isAdminRole(bytes32 _role) external view returns (bool) {
        return (_role == SITE_ADMIN_ROLE || _role == DEFAULT_ADMIN_ROLE);
    }

    /// @notice Test direct access to DEFAULT_ADMIN_ROLE from AccessControl
    /// @return bytes32 The default admin role identifier
    function getDefaultAdminRole() external pure returns (bytes32) {
        return DEFAULT_ADMIN_ROLE;
    }

    /// @notice Simulate the logic inside changeSiteAdmin for testing
    /// @param _newSiteAdmin The new role identifier to simulate
    /// @return bytes32 The current SITE_ADMIN_ROLE that would be changed
    function simulateChangeSiteAdmin(bytes32 _newSiteAdmin) external view returns (bytes32) {
        // Return what the old SITE_ADMIN_ROLE was before the change
        return SITE_ADMIN_ROLE;
    }

    /// @notice Test the internal hasRole logic without calling the public function
    /// @param role The role identifier to check
    /// @param account The address to check for the role
    /// @return bool True if the account has the role according to internal logic
    function testInternalHasRoleLogic(bytes32 role, address account) external view returns (bool) {
        // Replicate the internal logic from hasRole
        if (super.hasRole(DEFAULT_ADMIN_ROLE, account)) {
            return true;
        }
        if (role == PUBLIC_ROLE) {
            return !super.hasRole(PUBLIC_ROLE, account);
        }
        return super.hasRole(role, account);
    }

    /// @notice Test access to the parent hasRole function directly
    /// @param role The role identifier to check
    /// @param account The address to check for the role
    /// @return bool True if the account has the role according to parent implementation
    function testParentHasRole(bytes32 role, address account) external view returns (bool) {
        return super.hasRole(role, account);
    }
} 