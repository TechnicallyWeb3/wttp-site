/*
 * Ethereum Storage Protocol (ESP) - DataPointStorage Interface
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

/// @title Interface for Data Point Storage
/// @notice Defines methods for storing and retrieving data points
interface IDataPointStorage {
    /// @notice Returns the version of the storage implementation
    /// @return The version number
    function VERSION() external view returns (uint8);
    
    /// @notice Calculates the storage address for a data point
    /// @param _data The data point to calculate address for
    /// @return _dataPointAddress The calculated storage address
    function calculateAddress(
        bytes memory _data
    ) external pure returns (bytes32 _dataPointAddress);
    
    /// @notice Returns the size of a stored data point
    /// @param _dataPointAddress The address of the data point
    /// @return The size of the data point in bytes
    function dataPointSize(
        bytes32 _dataPointAddress
    ) external view returns (uint256);
    
    /// @notice Retrieves a stored data point
    /// @param _dataPointAddress The address of the data point
    /// @return The data point content
    function readDataPoint(
        bytes32 _dataPointAddress
    ) external view returns (bytes memory);
    
    /// @notice Stores a new data point
    /// @param _data The data point to store
    /// @return _dataPointAddress The address where the data point is stored
    function writeDataPoint(
        bytes memory _data
    ) external returns (bytes32 _dataPointAddress);
} 