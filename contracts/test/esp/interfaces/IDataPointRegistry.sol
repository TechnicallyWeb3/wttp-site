/*
 * Ethereum Storage Protocol (ESP) - DataPointRegistry Interface
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

import "./IDataPointStorage.sol";

/// @title Interface for Data Point Registry
/// @notice Defines methods for registering data points and managing royalties
interface IDataPointRegistry {
    /// @notice Gets the reference to the data point storage contract
    /// @return The data point storage contract

    function DPS_() external view returns (IDataPointStorage);
    
    /// @notice Writes a new data point and handles royalty logic
    /// @param _dataPoint The data point to write
    /// @param _publisher The publisher of the data point
    /// @return dataPointAddress The address where the data point is stored
    function registerDataPoint(
        bytes memory _dataPoint,
        address _publisher
    ) external payable returns (bytes32 dataPointAddress);
    
    /// @notice Calculates the royalty amount for a data point
    /// @param _dataPointAddress The address of the data point
    /// @return The calculated royalty amount in wei
    function getDataPointRoyalty(
        bytes32 _dataPointAddress
    ) external view returns (uint256);
    
    /// @notice Checks the royalty balance of a publisher
    /// @param _publisher The address of the publisher
    /// @return The current balance in wei
    function royaltyBalance(address _publisher) external view returns (uint256);
} 