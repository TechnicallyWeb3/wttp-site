/*
 * Ethereum Storage Protocol (ESP) - Core Types and Functions
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

event DataPointWritten(bytes32 indexed dataPointAddress);

error DataExists(bytes32 dataPointAddress);
error InvalidData();
error InvalidDPS();
error InsufficientRoyaltyPayment(uint256 royaltyCost);
error InvalidPublisher(address publisher);

event RoyaltiesCollected(address indexed publisher, uint256 amount, address indexed withdrawTo);
event RoyaltiesPaid(bytes32 indexed dataPointAddress, address indexed payer, uint256 amount);
event DataPointRegistered(bytes32 indexed dataPointAddress, address indexed publisher);


/// @notice Calculates a unique address for a data point
/// @dev Uses keccak256 hash of concatenated version and data
/// @param _data The data point
/// @param _version The version of the data point
/// @return bytes32 The calculated address
function calculateDataPointAddress(
    bytes memory _data,
    uint8 _version
) pure returns (bytes32) {
    return keccak256(abi.encodePacked(_data, _version));
}

/// @notice Structure for tracking royalty information
/// @dev Stores gas usage and publisher address for royalty calculations
struct DataPointRoyalty {
    uint256 gasUsed;
    address publisher;
}