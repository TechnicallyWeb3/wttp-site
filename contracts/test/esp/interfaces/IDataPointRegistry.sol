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
import "./ESPTypes.sol";

/// @title Interface for Data Point Registry
/// @notice Defines methods for registering data points and managing royalties
interface IDataPointRegistry {
    /// @notice Gets the reference to the data point storage contract
    /// @return The data point storage contract
    function DPS_() external view returns (IDataPointStorage);
    /// @notice Sets the data point storage contract
    /// @param _dps The address of the data point storage contract
    function setDPS(address _dps) external;
    /// @notice Sets the royalty rate
    /// @param _royaltyRate The royalty rate
    function setRoyaltyRate(uint256 _royaltyRate) external;
    /// @notice Gets the royalty rate
    /// @return The royalty rate
    function royaltyRate() external view returns (uint256);
    /// @notice Updates the royalty record
    /// @param _dataPointAddress The address of the data point
    /// @param _dataPointRoyalty The royalty record
    function updateRoyaltyRecord(bytes32 _dataPointAddress, DataPointRoyalty memory _dataPointRoyalty) external;
    /// @notice Updates the publisher address
    /// @param _dataPointAddress The address of the data point
    /// @param _newPublisher The new publisher address
    function updatePublisherAddress(bytes32 _dataPointAddress, address _newPublisher) external;
    
    /// @notice Calculates the royalty amount for a data point
    /// @param _dataPointAddress The address of the data point
    /// @return The calculated royalty amount in wei
    function getDataPointRoyalty(bytes32 _dataPointAddress) external view returns (uint256);
    /// @notice Transfers the amount of royalties of the publisher, can be called by the owner
    /// @param _publisher The address of the publisher's balance to withdraw from address(0) for unaccounted for value
    /// @param _to The address to transfer the amount to
    /// @param _amount The amount of publisher's royalty balance to transfer
    function transfer(address _publisher, address _to, uint256 _amount) external;
    /// @notice Collects the royalties of the publisher, can be called by the publisher
    /// @param _amount The amount of royalties to collect
    /// @param _withdrawTo The address to withdraw the royalties to
    function collectRoyalties(uint256 _amount, address _withdrawTo) external payable;
    /// @notice Gets the royalty balance of the publisher
    /// @param _publisher The address of the publisher
    /// @return The royalty balance of the publisher
    function royaltyBalance(address _publisher) external view returns (uint256);

    /// @notice Writes a new data point and handles royalty logic
    /// @param _dataPoint The data point to write
    /// @param _publisher The publisher of the data point
    /// @return dataPointAddress The address where the data point is stored
    function registerDataPoint(bytes memory _dataPoint, address _publisher) external payable returns (bytes32 dataPointAddress);

    // ============= Openzeppelin Ownable =============
    /// @dev The caller account is not authorized to perform an operation.
    error OwnableUnauthorizedAccount(address account);

    /// @dev The owner is not a valid owner account. (eg. `address(0)`)
    error OwnableInvalidOwner(address owner);

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    
    /// @notice Gets the current owner of the contract
    /// @return The address of the current owner
    function owner() external view returns (address);
    /// @notice Renounces ownership of the contract
    function renounceOwnership() external;
    /// @notice Transfers ownership of the contract to a new account
    /// @param newOwner The address of the new owner
    function transferOwnership(address newOwner) external;

} 