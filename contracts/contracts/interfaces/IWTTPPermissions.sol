// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/IAccessControl.sol";
import "@wttp/core/contracts/interfaces/WTTPTypes.sol";

/// @title WTTP Permissions Contract
/// @notice Manages role-based access control for the WTTP protocol
interface IBaseWTTPPermissions is IAccessControl {

    /// @notice Check if an account has a specific role
    /// @dev Overrides the standard AccessControl implementation to grant DEFAULT_ADMIN_ROLE holders access to all roles
    /// @param role The role identifier to check
    /// @param account The address to check for the role
    /// @return bool True if the account has the role or is a DEFAULT_ADMIN_ROLE holder
    function hasRole(bytes32 role, address account) external view returns (bool);
    /// @notice Creates a new resource-specific admin role
    /// @dev Sets the SITE_ADMIN_ROLE as the admin of the new role, preventing creation of privileged roles
    /// @param _role The new role identifier to create
    function createResourceRole(bytes32 _role) external;
    /// @notice Changes the SITE_ADMIN_ROLE identifier
    /// @dev Allows wiping all current site admin permissions by changing the role hash
    /// @param _newSiteAdmin The new role identifier to use for site administrators
    function changeSiteAdmin(bytes32 _newSiteAdmin) external;
    function getSiteAdminRole() external view returns (bytes32);
}
