// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/IAccessControl.sol";
import "@wttp/core/contracts/types/WTTPTypes.sol";

/// @title WTTP Permissions Contract
/// @author Web3 Transfer Protocol (WTTP) Development Team
/// @notice Manages role-based access control for the WTTP protocol
interface IBaseWTTPPermissions is IAccessControl {

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
