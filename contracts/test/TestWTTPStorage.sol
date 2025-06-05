// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.20;

import "../WTTPStorage.sol";

/// @title Test WTTP Storage Contract
/// @notice Concrete implementation of the WTTPStorage abstract contract for testing
/// @dev Provides a deployable implementation of the WTTP storage system with exposed internal methods and full debugging access
contract TestWTTPStorage is WTTPStorage {

    // ========== Test-only Storage for Direct Access ==========
    
    /// @notice Test storage for direct header manipulation
    mapping(bytes32 => HeaderInfo) public testHeaders;
    
    /// @notice Test storage for direct metadata manipulation  
    mapping(string => ResourceMetadata) public testMetadata;
    
    /// @notice Test storage for direct resource manipulation
    mapping(string => bytes32[]) public testResources;

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

    // ========== Exposed Internal Variables ==========
    
    /// @notice Public getter for the internal DPR_ variable
    /// @return IDataPointRegistry The internal DPR reference
    function getDPR_() external view returns (IDataPointRegistry) {
        return DPR_;
    }

    /// @notice Public setter for DPR_ for testing purposes
    /// @dev Allows direct manipulation of the DPR reference for debugging
    /// @param _dpr New DPR address
    function setDPR_ForTesting(address _dpr) external {
        DPR_ = IDataPointRegistry(_dpr);
    }

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
    /// @param _path The path of the resource
    /// @return HeaderInfo The header information
    function readHeader(
        string memory _path
    ) external view returns (HeaderInfo memory) {
        return _readHeader(_path);
    }

    /// @notice Store header in test storage for direct manipulation
    /// @param _headerAddress The header address to set
    /// @param _header The header information to store
    function setTestHeader(bytes32 _headerAddress, HeaderInfo memory _header) external {
        testHeaders[_headerAddress] = _header;
    }

    /// @notice Get header from test storage
    /// @param _headerAddress The header address to read
    /// @return HeaderInfo The header information at the given address
    function getTestHeader(bytes32 _headerAddress) external view returns (HeaderInfo memory) {
        return testHeaders[_headerAddress];
    }

    /// @notice Public wrapper for _setDefaultHeader
    /// @param _header The header information to use as default
    function setDefaultHeaderPublic(HeaderInfo memory _header) external {
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

    /// @notice Store metadata in test storage for direct manipulation
    /// @param _path Path of the resource
    /// @param _metadata Metadata to store
    function setTestMetadata(string memory _path, ResourceMetadata memory _metadata) external {
        testMetadata[_path] = _metadata;
    }

    /// @notice Get metadata from test storage
    /// @param _path Path of the resource
    /// @return ResourceMetadata The metadata stored at the path
    function getTestMetadata(string memory _path) external view returns (ResourceMetadata memory) {
        return testMetadata[_path];
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
    
    /// @notice Public wrapper for _resourceExists for testing
    /// @param _path Path of the resource to check
    /// @return bool True if the resource exists
    function resourceExists(
        string memory _path
    ) external view returns (bool) {
        return _resourceExists(_path);
    }

    /// @notice Store resource in test storage for direct manipulation
    /// @param _path Path of the resource
    /// @param _dataPoints Array of data point addresses to store
    function setTestResource(string memory _path, bytes32[] memory _dataPoints) external {
        testResources[_path] = _dataPoints;
    }

    /// @notice Get resource from test storage
    /// @param _path Path of the resource
    /// @return bytes32[] Array of data point addresses
    function getTestResource(string memory _path) external view returns (bytes32[] memory) {
        return testResources[_path];
    }

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

    // ========== Exposed Modifiers ==========
    
    /// @notice Public wrapper to test the notImmutable modifier
    /// @param _path Path to test the modifier with
    function testNotImmutableModifier(string memory _path) external view notImmutable(_path) {
        // This function will revert if the resource is immutable
    }

    /// @notice Test if a resource would trigger the notImmutable modifier
    /// @param _path Path to check
    /// @return bool True if the resource is immutable and exists (using internal functions)
    function isResourceImmutable(string memory _path) external view returns (bool) {
        ResourceMetadata memory meta = _readMetadata(_path);
        HeaderInfo memory headerInfo = _readHeader(_path);
        bytes32[] memory resourceData = _readResource(_path);
        return headerInfo.cache.immutableFlag && resourceData.length > 0;
    }

    // ========== Exposed Constants and Variables ==========
    
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

    // ========== Additional Debugging Functions ==========
    
    /// @notice Get the header address that would be generated for a given header
    /// @param _header The header to calculate address for
    /// @return bytes32 The header address
    function calculateHeaderAddress(HeaderInfo memory _header) external view returns (bytes32) {
        return getHeaderAddress(_header);
    }

    /// @notice Check if a header exists by checking if we can read a valid header for a path
    /// @param _path The path to check header existence for
    /// @return bool True if the header exists and is valid
    function headerExistsForPath(string memory _path) external view returns (bool) {
        ResourceMetadata memory meta = _readMetadata(_path);
        if (meta.header == bytes32(0)) return true; // default header
        HeaderInfo memory headerInfo = _readHeader(_path);
        return headerInfo.cors.origins.length > 0;
    }

    /// @notice Get the size of a resource using internal function
    /// @param _path Path of the resource
    /// @return uint256 Number of chunks in the resource
    function getResourceChunkCount(string memory _path) external view returns (uint256) {
        bytes32[] memory resourceData = _readResource(_path);
        return resourceData.length;
    }

    /// @notice Get resource size from metadata
    /// @param _path Path of the resource
    /// @return uint256 Total size in bytes
    function getResourceSize(string memory _path) external view returns (uint256) {
        ResourceMetadata memory meta = _readMetadata(_path);
        return meta.size;
    }

    /// @notice Get resource version from metadata
    /// @param _path Path of the resource
    /// @return uint256 Resource version
    function getResourceVersion(string memory _path) external view returns (uint256) {
        ResourceMetadata memory meta = _readMetadata(_path);
        return meta.version;
    }

    /// @notice Get resource last modified timestamp from metadata
    /// @param _path Path of the resource
    /// @return uint256 Last modified timestamp
    function getResourceLastModified(string memory _path) external view returns (uint256) {
        ResourceMetadata memory meta = _readMetadata(_path);
        return meta.lastModified;
    }

    /// @notice Test helper to add elements to test resource array
    /// @param _path Path of the resource
    /// @param _dataPoint Data point address to add
    function addToTestResource(string memory _path, bytes32 _dataPoint) external {
        testResources[_path].push(_dataPoint);
    }

    /// @notice Test helper to clear test storage completely
    function clearAllTestStorage() external {
        // Note: This doesn't actually clear mappings, but provides a function to indicate clearing intent
        // In practice, you'd need to track keys and delete them individually
    }
} 