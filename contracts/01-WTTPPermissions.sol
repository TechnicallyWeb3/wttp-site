/*
 * Web3 Transfer Protocol (WTTP) - WTTPStorage Contract
 * Copyright (C) 2025 TechnicallyWeb3
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * 
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 * 
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.20;

/// build ./interfaces/IWTTPPermissions.sol

/// import "@openzeppelin/contracts/access/IAccessControl.sol";
/// import "@wttp/core/contracts/types/WTTPTypes.sol";
/// replace AccessControl with IAccessControl
/// exclude hasRole
// this shouldn't be needed, overrides should automatically be excluded by hardhat-build

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@wttp/core/contracts/types/WTTPTypes.sol";

/// @title WTTP Permissions Contract
/// @author Web3 Transfer Protocol (WTTP) Development Team
/// @notice Manages role-based access control for the WTTP protocol
/// @dev Extends OpenZeppelin's AccessControl with site-specific roles and custom permission logic
abstract contract WTTPPermissions is AccessControl { 

    /// @notice Role identifier for site administrators
    /// @dev Calculated via keccak256 during construction. Site admins have elevated privileges but below the DEFAULT_ADMIN_ROLE
    bytes32 internal SITE_ADMIN_ROLE;
    bytes32 internal constant PUBLIC_ROLE = bytes32(uint256(type(uint256).max));
    bytes32 internal constant BLACKLIST_ROLE = keccak256("BLACKLIST_ROLE");

    /// @notice Sets up initial roles and permissions
    /// @dev Creates the SITE_ADMIN_ROLE and establishes DEFAULT_ADMIN_ROLE as its admin
    /// @param _owner Address of the contract owner who receives the DEFAULT_ADMIN_ROLE
    constructor(address _owner) {
        SITE_ADMIN_ROLE = keccak256("SITE_ADMIN_ROLE");
        _grantRole(DEFAULT_ADMIN_ROLE, _owner);
        _setRoleAdmin(SITE_ADMIN_ROLE, DEFAULT_ADMIN_ROLE);
    }

    /// @notice Check if an account has a specific role
    /// @dev Overrides the standard AccessControl implementation to grant DEFAULT_ADMIN_ROLE holders access to all roles
    /// @param role The role identifier to check
    /// @param account The address to check for the role
    /// @return bool True if the account has the role or is a DEFAULT_ADMIN_ROLE holder
    function hasRole(bytes32 role, address account) public view override virtual returns (bool) {
        // If the account is a DEFAULT_ADMIN_ROLE holder, they have access to all roles.
        if (super.hasRole(DEFAULT_ADMIN_ROLE, account)) {
            return true;
        }

        if (role == PUBLIC_ROLE) {
            return !super.hasRole(BLACKLIST_ROLE, account);
        }

        return super.hasRole(role, account);
    }

    // to include or not to include, that is the question...
    // do we restrict this or should the implementation decide?
    // this means we can only have 1 DEFAULT_ADMIN... you know what
    // we should probably just remove this, it's not really needed
    // function grantRole(bytes32 role, address account) public override virtual {
    //     if(role == DEFAULT_ADMIN_ROLE) {
    //         revert InvalidRole(role);
    //     }
    //     super.grantRole(role, account);
    // }

    // function changeDefaultAdmin(address newAdmin) public virtual onlyRole(DEFAULT_ADMIN_ROLE) {
    //     _grantRole(DEFAULT_ADMIN_ROLE, newAdmin);
    //     _revokeRole(DEFAULT_ADMIN_ROLE, msg.sender);
    //     // already emits granted and revoked events
    // }

    /// @notice Modifier to prevent certain actions on admin roles
    /// @dev Used to prevent modification of privileged roles
    /// @param role The role identifier to check
    modifier notAdminRole(bytes32 role) {
        if(
            role == SITE_ADMIN_ROLE || 
            role == DEFAULT_ADMIN_ROLE
        ) {
            revert InvalidRole(role);
        }
        _;
    }

    modifier notPublicRole(bytes32 role) {
        if(
            role == PUBLIC_ROLE || 
            role == BLACKLIST_ROLE
        ) {
            revert InvalidRole(role);
        }
        _;
    }
       
    /// @notice Creates a new resource-specific admin role
    /// @dev Sets the SITE_ADMIN_ROLE as the admin of the new role, preventing creation of privileged roles
    /// @param _role The new role identifier to create
    function createResourceRole(bytes32 _role) external 
    onlyRole(SITE_ADMIN_ROLE) notAdminRole(_role) notPublicRole(_role) {
        _setRoleAdmin(_role, SITE_ADMIN_ROLE);
        emit ResourceRoleCreated(_role);
    }

    /// @notice Changes the SITE_ADMIN_ROLE identifier
    /// @dev Allows wiping all current site admin permissions by changing the role hash
    /// @param _newSiteAdmin The new role identifier to use for site administrators
    function changeSiteAdmin(bytes32 _newSiteAdmin) external onlyRole(DEFAULT_ADMIN_ROLE) {
        bytes32 oldSiteAdmin = SITE_ADMIN_ROLE;
        SITE_ADMIN_ROLE = _newSiteAdmin;
        emit SiteAdminChanged(oldSiteAdmin, SITE_ADMIN_ROLE);
    }

    function getSiteAdminRole() external view returns (bytes32) {
        return SITE_ADMIN_ROLE;
    }
    
}