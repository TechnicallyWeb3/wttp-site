// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@tw3/wttp-core/contracts/interfaces/WTTPTypes.sol";

/// @title WTTP Permissions Contract
/// @notice Manages role-based access control for the WTTP protocol
/// @dev Extends OpenZeppelin's AccessControl with site-specific roles and custom permission logic
abstract contract WTTPPermissionsV3 is AccessControl {

    /// @notice Role identifier for site administrators
    /// @dev Calculated via keccak256 during construction. Site admins have elevated privileges but below the DEFAULT_ADMIN_ROLE
    bytes32 internal SITE_ADMIN_ROLE;

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
        if (super.hasRole(DEFAULT_ADMIN_ROLE, account)) {
            return true;
        }
        return super.hasRole(role, account);
    }

    /// @notice Modifier to prevent certain actions on admin roles
    /// @dev Used to prevent modification of privileged roles
    /// @param role The role identifier to check
    modifier notAdminRole(bytes32 role) {
        if(
            role == SITE_ADMIN_ROLE || 
            role == DEFAULT_ADMIN_ROLE
            // || role == PUBLIC_ROLE
        ) {
            revert InvalidRole(role);
        }
        _;
    }
       
    /// @notice Creates a new resource-specific admin role
    /// @dev Sets the SITE_ADMIN_ROLE as the admin of the new role, preventing creation of privileged roles
    /// @param _role The new role identifier to create
    function createResourceRole(bytes32 _role) external onlyRole(SITE_ADMIN_ROLE) notAdminRole(_role) {
        _setRoleAdmin(_role, SITE_ADMIN_ROLE);
        emit ResourceRoleCreated(_role);
    }

    /// @notice Changes the SITE_ADMIN_ROLE identifier
    /// @dev Allows wiping all current site admin permissions by changing the role hash
    /// @param _newSiteAdmin The new role identifier to use for site administrators
    function changeSiteAdmin(bytes32 _newSiteAdmin) external onlyRole(DEFAULT_ADMIN_ROLE) {
        emit SiteAdminChanged(SITE_ADMIN_ROLE, _newSiteAdmin);
        SITE_ADMIN_ROLE = _newSiteAdmin;
    }
}