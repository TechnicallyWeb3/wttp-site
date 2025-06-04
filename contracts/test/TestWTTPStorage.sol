// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.20;

import "../WTTPStorage.sol";

/// @title Test WTTP Storage Contract
/// @notice Concrete implementation of the WTTPStorage abstract contract for testing
/// @dev Provides a deployable implementation of the WTTP storage system with exposed internal methods
contract TestWTTPStorage is WTTPStorage {

    /// @notice Initializes the storage contract with test dependencies
    /// @dev Sets up DPR, default header, and owner for testing
    /// @param _owner Address that will receive the DEFAULT_ADMIN_ROLE
    /// @param _dpr Address of the Data Point Registry contract
    /// @param _defaultHeader Default header info to use for resources
    constructor(
        address _owner,
        address _dpr,
        HeaderInfo memory _defaultHeader
    ) WTTPStorage(_owner, _dpr, _defaultHeader) {}

    // ========== Exposed Header Operations ==========
    
    /// @notice Public wrapper to create headers for testing
    /// @param _header The header information to store
    /// @return headerAddress The unique identifier for the stored header
    function createHeader(
        HeaderInfo memory _header
    ) external returns (bytes32 headerAddress) {
        return _createHeader(_header);
    }

    /// @notice Public wrapper to read headers for testing
    /// @param _headerAddress The unique identifier of the header
    /// @return HeaderInfo The header information
    function readHeader(
        bytes32 _headerAddress
    ) external view returns (HeaderInfo memory) {
        return _readHeader(_headerAddress);
    }

    /// @notice Public wrapper to set default header for testing
    /// @param _header The header information to use as default
    function setDefaultHeader(
        HeaderInfo memory _header
    ) external {
        _setDefaultHeader(_header);
    }

    // ========== Exposed Metadata Operations ==========
    
    /// @notice Public wrapper to read metadata for testing
    /// @param _path Path of the resource
    /// @return _metadata Metadata information for the resource
    function readMetadata(
        string memory _path
    ) external view returns (ResourceMetadata memory _metadata) {
        return _readMetadata(_path);
    }

    /// @notice Public wrapper to update metadata stats for testing
    /// @param _path Path of the resource to update
    function updateMetadataStats(string memory _path) external {
        _updateMetadataStats(_path);
    }

    /// @notice Public wrapper to update metadata for testing
    /// @param _path Path of the resource to update
    /// @param _metadata New metadata to store
    function updateMetadata(
        string memory _path, 
        ResourceMetadata memory _metadata
    ) external {
        _updateMetadata(_path, _metadata);
    }

    /// @notice Public wrapper to delete metadata for testing
    /// @param _path Path of the resource to delete
    function deleteMetadata(
        string memory _path
    ) external {
        _deleteMetadata(_path);
    }

    // ========== Exposed Resource Operations ==========
    
    /// @notice Public wrapper to create resources for testing
    /// @param _path Path where the resource will be stored
    /// @param _dataRegistration Registration data including content and publisher
    /// @return _dataPointAddress The address of the newly created data point
    function createResource(
        string memory _path,
        DataRegistration memory _dataRegistration
    ) external payable returns (bytes32 _dataPointAddress) {
        return _createResource(_path, _dataRegistration);
    }

    /// @notice Public wrapper to read resources for testing
    /// @param _path Path of the resource
    /// @return Array of data point addresses comprising the resource
    function readResource(
        string memory _path
    ) external view returns (bytes32[] memory) {
        return _readResource(_path);
    }

    /// @notice Public wrapper to update resources for testing
    /// @param _path Path of the resource
    /// @param _dataPointAddress Address of the data point chunk
    /// @param _chunkIndex Index position of the chunk in the resource array
    function updateResource(
        string memory _path,
        bytes32 _dataPointAddress,
        uint256 _chunkIndex
    ) external {
        _updateResource(_path, _dataPointAddress, _chunkIndex);
    }

    /// @notice Public wrapper to delete resources for testing
    /// @param _path Path of the resource to delete
    function deleteResource(
        string memory _path
    ) external {
        _deleteResource(_path);
    }

    /// @notice Public wrapper to upload resources for testing
    /// @param _path Path of the resource
    /// @param _dataRegistration Array of registration data for multiple chunks
    /// @return _dataPointAddresses Array of addresses for the created data points
    function uploadResource(
        string memory _path,
        DataRegistration[] memory _dataRegistration
    ) external payable returns (bytes32[] memory _dataPointAddresses) {
        return _uploadResource(_path, _dataRegistration);
    }

    // ========== Test Helper Functions ==========
    
    /// @notice Public wrapper to test the notImmutable modifier
    /// @param _path Path to test the modifier with
    function testNotImmutableModifier(string memory _path) external view notImmutable(_path) {
        // This function will revert if the resource is immutable
    }

    /// @notice Public getter for MAX_METHODS constant
    /// @return uint16 The maximum number of methods
    function getMaxMethods() external pure returns (uint16) {
        return MAX_METHODS;
    }

    /// @notice Public getter for zero header for testing
    /// @return HeaderInfo The zero header structure
    function getZeroHeader() external view returns (HeaderInfo memory) {
        return zeroHeader;
    }

    /// @notice Public getter for zero metadata for testing
    /// @return ResourceMetadata The zero metadata structure
    function getZeroMetadata() external view returns (ResourceMetadata memory) {
        return zeroMetadata;
    }
} 