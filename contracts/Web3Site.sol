// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.20;

import "./BaseWTTPSite.sol";

contract Web3Site is BaseWTTPSite {

    constructor(
        address _owner, 
        address _dpr, 
        HeaderInfo memory _defaultHeader
    ) BaseWTTPSite(_owner, _dpr, _defaultHeader) {}

    function setDefaultHeader(HeaderInfo memory _defaultHeader) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _setDefaultHeader(_defaultHeader);
    }

}