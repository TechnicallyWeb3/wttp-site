// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.20;

import "../../contracts/BaseWTTPPermissions.sol";

contract TestWTTPPermissions is BaseWTTPPermissions {

    constructor(address _owner) BaseWTTPPermissions(_owner) {}

    function testSiteAdminRole() public view returns (bytes32) {
        return SITE_ADMIN_ROLE;
    }
    
    function testPublicRole() external pure returns (bytes32) {
        return PUBLIC_ROLE;
    }

    function testBlacklistRole() external pure returns (bytes32) {
        return BLACKLIST_ROLE;
    }

    function testNotAdminRole(bytes32 role) public view notAdminRole(role) returns (bool) {
        return true;
    }

    function testNotPublicRole(bytes32 role) public pure notPublicRole(role) returns (bool) {
        return true;
    }
}