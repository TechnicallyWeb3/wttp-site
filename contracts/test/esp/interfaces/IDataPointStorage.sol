// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Copyright (C) 2025 TechnicallyWeb3

import "../types/ESPTypes.sol";

/// @title Data Point Storage Contract
/// @notice Provides core storage functionality for data points
/// @dev Basic implementation without collision handling
interface IDataPointStorage {

    function VERSION() external pure returns (uint8);

    /// @notice Calculates the storage address for a data point
    /// @param _data The data point to calculate address for
    /// @return _dataPointAddress The calculated storage address
    function calculateAddress(bytes memory _data) external pure returns (bytes32 _dataPointAddress);
    function dataPointSize(bytes32 _dataPointAddress) external view returns (uint256);
    function readDataPoint(bytes32 _dataPointAddress) external view returns (bytes memory);
    /// @notice Stores a new data point with user-specified version
    /// @dev Reverts if the calculated address is already occupied
    /// @param _data The data point to store
    /// @return _dataPointAddress The address where the data point is stored
    function writeDataPoint(bytes memory _data) external returns (bytes32 _dataPointAddress);
}
