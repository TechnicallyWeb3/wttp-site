// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Copyright (C) 2025 TechnicallyWeb3

import "../types/ESPTypes.sol";
import "./IDataPointStorage.sol";
import "./IOwnable.sol";

/// @title Data Point Registry Contract
/// @notice Manages data point publishing and royalty payments
/// @dev Extends storage functionality with economic incentives
interface IDataPointRegistry is IOwnable {

    function royaltyRate() external view returns (uint256);

    function DPS() external view returns (IDataPointStorage);
    function setDPS(address _dps) external;
    function setRoyaltyRate(uint256 _royaltyRate) external;
    function updateRoyaltyRecord(bytes32 _dataPointAddress, DataPointRoyalty memory _dataPointRoyalty) external;
    function updatePublisherAddress(bytes32 _dataPointAddress, address _newPublisher) external;
    /// @notice Calculates the royalty amount for a data point with overflow protection
    /// @param _dataPointAddress The address of the data point
    /// @return The calculated royalty amount in wei
    function getDataPointRoyalty(bytes32 _dataPointAddress) external view returns (uint256);
    /// @notice Allows the owner to transfer royalties to a different address
    /// @param _publisher The address of the publisher
    /// @param _amount The amount to transfer
    /// @param _to The address to send the royalties to
    /// @dev Should be protected by a strong consensus mechanism
    function transfer(address _publisher, uint256 _amount, address _to) external;
    /// @notice Allows publishers to withdraw their earned royalties
    /// @param _amount The amount to withdraw
    /// @param _withdrawTo The address to send the royalties to
    function collectRoyalties(uint256 _amount, address _withdrawTo) external;
    /// @notice Checks the royalty balance of a publisher
    /// @param _publisher The address of the publisher
    /// @return The current balance in wei
    function royaltyBalance(address _publisher) external view returns (uint256);
    /// @notice Writes a new data point and handles royalty logic
    /// @dev Use address(0) as publisher to waive royalties
    /// @param _dataPoint The data point to write
    /// @param _publisher The publisher of the data point, can be address(0) to waive royalties
    /// @return dataPointAddress The address where the data point is stored
    function registerDataPoint(bytes memory _dataPoint, address _publisher) external payable returns (bytes32 dataPointAddress);
}
