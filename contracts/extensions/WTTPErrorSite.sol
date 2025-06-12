// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.20;

import "../interfaces/IBaseWTTPSite.sol";

abstract contract WTTPErrorSite {

    IBaseWTTPSite public immutable site;

    constructor(address _siteAddress) {
        site = IBaseWTTPSite(_siteAddress);
    }

    
}