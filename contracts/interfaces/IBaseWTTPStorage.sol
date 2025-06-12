// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./IBaseWTTPPermissions.sol";

/// @title WTTP Base Storage Contract
/// @author Web3 Transfer Protocol (WTTP) Development Team
/// @notice Manages web resource storage and access control
/// @dev Core storage functionality for the WTTP protocol, inheriting permission management
interface IBaseWTTPStorage is IBaseWTTPPermissions {

    /// @return IDataPointStorage The Data Point Storage contract
    function DPS() external view returns (IDataPointStorage);
    /// @notice Returns the Data Point Registry contract instance
    /// @dev Provides external access to the internal DPR_ reference
    /// @return IDataPointRegistry The Data Point Registry contract
    function DPR() external view returns (IDataPointRegistry);
}
