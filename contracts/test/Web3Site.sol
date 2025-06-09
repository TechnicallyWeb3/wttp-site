// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.20;

import "../BaseWTTPSite.sol";

contract Web3Site is TestWTTPSite {

    constructor(address _owner, address _dpr, HeaderInfo memory _defaultHeader) TestWTTPSite(_owner, _dpr, _defaultHeader) {}

}