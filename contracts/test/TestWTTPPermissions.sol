// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.20;

import "../WTTPPermissions.sol";

/// @title Test WTTP Permissions Contract
/// @notice Concrete implementation of the WTTPPermissions abstract contract for testing
/// @dev Provides a deployable implementation of the WTTP permissions system
contract TestWTTPPermissions is WTTPPermissions {

    /// @notice Initializes the permissions contract with an owner
    /// @dev Sets up roles and permissions, then passes to parent constructor
    /// @param _owner Address that will receive the DEFAULT_ADMIN_ROLE
    constructor(address _owner) WTTPPermissions(_owner) {}

    /// @notice Public wrapper to expose the SITE_ADMIN_ROLE for testing
    /// @return bytes32 The site admin role identifier
    function getSiteAdminRole() external view returns (bytes32) {
        return SITE_ADMIN_ROLE;
    }

    /// @notice Public wrapper to test the notAdminRole modifier
    /// @param _role Role to test the modifier with
    function testNotAdminRoleModifier(bytes32 _role) external view notAdminRole(_role) {
        // This function will revert if _role is an admin role
    }
} 