/*
 * Ethereum Storage Protocol (ESP) - DataPointRegistry Contract
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

// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.20;

/// !interface build ./interfaces/IDataPointRegistry.sol

/// !interface import ../types/ESPTypes.sol
/// !interface import "./IDataPointStorage.sol";
/// !interface import "./IOwnable.sol";

/// !interface module "@openzeppelin/contracts/access/Ownable.sol" to "./interfaces/IOwnable.sol --remove Context"
/// !interface remove ReentrancyGuard
/// !interface replace Ownable with IOwnable
/// !interface getter DPS_

import "./types/ESPTypes.sol";
import "./interfaces/IDataPointStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title Data Point Registry Contract
/// @notice Manages data point publishing and royalty payments
/// @dev Extends storage functionality with economic incentives
/// @custom:security ESP_FINGERPRINT_TW3_2025_DPR_v2
contract DataPointRegistry is Ownable, ReentrancyGuard {

    IDataPointStorage public DPS_;

    /// @notice Contract constructor
    /// @param _owner Should be a DAO or multisig, has admin control over the contract
    /// @param _dps Address of the DataPointStorage contract
    /// @param _royaltyRate Royalty rate in wei (should be 0.1-1% of chain's average gas fees)
    constructor(address _owner, address _dps, uint256 _royaltyRate) Ownable(_owner) {
        _setDPS(_dps);
        royaltyRate = _royaltyRate;
    }

    function _setDPS(address _dps) internal {
        // Use a low-level call instead of direct function call
        bytes memory testDataPoint = bytes("DPS_TEST");
        (bool success, bytes memory data) = _dps.call(
            abi.encodeWithSignature("calculateAddress(bytes)", testDataPoint)
        );
        
        if (success && data.length == 32) {
            bytes32 dataPointAddress = abi.decode(data, (bytes32));
            IDataPointStorage _DPS = IDataPointStorage(_dps);
            if (dataPointAddress != calculateDataPointAddress(testDataPoint, _DPS.VERSION())) {
                revert InvalidDPS();
            }
            DPS_ = _DPS;
        } else {
            revert InvalidDPS();
        }
    }

    function setDPS(address _dps) public onlyOwner {
        _setDPS(_dps);
    }

    function setRoyaltyRate(uint256 _royaltyRate) public onlyOwner {
        royaltyRate = _royaltyRate;
    }

    // should be protected a strong consensus mechanism
    function updateRoyaltyRecord(
        bytes32 _dataPointAddress,
        DataPointRoyalty memory _dataPointRoyalty
    ) external onlyOwner {
        dataPointRoyalty[_dataPointAddress] = _dataPointRoyalty;
    }

    function updatePublisherAddress(
        bytes32 _dataPointAddress,
        address _newPublisher
    ) external {
        DataPointRoyalty storage royalty = dataPointRoyalty[_dataPointAddress];
        if (royalty.publisher != msg.sender) {
            revert InvalidPublisher(royalty.publisher);
        }
        royalty.publisher = _newPublisher;
    }

    uint256 public royaltyRate;
    mapping(bytes32 => DataPointRoyalty) private dataPointRoyalty;
    mapping(address => uint256) private publisherBalance;

    /// @notice Calculates the royalty amount for a data point with overflow protection
    /// @param _dataPointAddress The address of the data point
    /// @return The calculated royalty amount in wei
    function getDataPointRoyalty(
        bytes32 _dataPointAddress
    ) public view virtual returns (uint256) {
        return dataPointRoyalty[_dataPointAddress].gasUsed * royaltyRate;
    }

    /// @notice Transfers royalties to a different address with reentrancy protection
    /// @param _publisher The address of the publisher
    /// @param _amount The amount to transfer
    /// @param _to The address to send the royalties to
    function _transfer(address _publisher, uint256 _amount, address _to) internal {
        if(_amount > 0) {
            // Checks-Effects-Interactions pattern: Update state before external call
            if(_publisher != address(0)) {
                publisherBalance[_publisher] -= _amount;
            }
            
            // External call after state update
            payable(_to).transfer(_amount);
            emit RoyaltiesCollected(_publisher, _amount, _to);
        }
    }

    /// @notice Allows the owner to transfer royalties to a different address
    /// @param _publisher The address of the publisher
    /// @param _amount The amount to transfer
    /// @param _to The address to send the royalties to
    /// @dev Should be protected by a strong consensus mechanism
    function transfer(address _publisher, uint256 _amount, address _to) public onlyOwner nonReentrant {
        _transfer(_publisher, _amount, _to);
    }

    /// @notice Allows publishers to withdraw their earned royalties
    /// @param _amount The amount to withdraw
    /// @param _withdrawTo The address to send the royalties to
    function collectRoyalties(uint256 _amount, address _withdrawTo) public nonReentrant {
        _transfer(msg.sender, _amount, _withdrawTo);
    }

    /// @notice Checks the royalty balance of a publisher
    /// @param _publisher The address of the publisher
    /// @return The current balance in wei
    function royaltyBalance(address _publisher) public view returns (uint256) {
        return publisherBalance[_publisher];
    }

    /// @notice Writes a new data point and handles royalty logic
    /// @dev Use address(0) as publisher to waive royalties
    /// @param _dataPoint The data point to write
    /// @param _publisher The publisher of the data point, can be address(0) to waive royalties
    /// @return dataPointAddress The address where the data point is stored
    function registerDataPoint(
        bytes memory _dataPoint,
        address _publisher
    ) public payable nonReentrant returns (bytes32 dataPointAddress) {
        dataPointAddress = DPS_.calculateAddress(_dataPoint);
        DataPointRoyalty storage royalty = dataPointRoyalty[dataPointAddress];
        uint256 royaltyCost = getDataPointRoyalty(dataPointAddress);

        // if the data point is already owned by the publisher, we can return the address without doing anything
        if (royalty.publisher == msg.sender) {
            publisherBalance[royalty.publisher] += royaltyCost;
            return dataPointAddress;
        }

        // if the data point is new, we need to write it to the storage contract
        if (DPS_.dataPointSize(dataPointAddress) == 0) {
            
            // Calculate gas for royalties if not waiving
            if (_publisher != address(0)) {
                uint256 startGas = gasleft();
                DPS_.writeDataPoint(_dataPoint);
                uint256 gasUsed = startGas - gasleft();
                royalty.gasUsed = gasUsed;
                royalty.publisher = _publisher;
            } else {
                DPS_.writeDataPoint(_dataPoint);
            }
            emit DataPointRegistered(dataPointAddress, royalty.publisher);
        } else {
            // the data point already exists, so we need to pay the publisher royalties
            if (royalty.publisher != address(0)) {
                if(msg.value < royaltyCost) {
                    revert InsufficientRoyaltyPayment(royaltyCost);
                }
                uint256 royaltyFee = royaltyCost / 10;
                publisherBalance[royalty.publisher] += royaltyCost - royaltyFee;
                publisherBalance[owner()] += royaltyFee;
                emit RoyaltiesPaid(dataPointAddress, msg.sender, royaltyCost);
            }
        }
    }
}