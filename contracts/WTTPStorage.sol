// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.20;

import "./WTTPPermissions.sol";
import "@tw3/esp/contracts/interfaces/IDataPointRegistry.sol";

/// @title WTTP Storage Contract
/// @notice Manages web resource storage and access control
/// @dev Core storage functionality for the WTTP protocol, inheriting permission management
///      Resources are stored as chunks of data points with associated metadata and headers
abstract contract WTTPStorage is WTTPPermissions {

    /// @notice Initializes the storage contract with core dependencies and defaults
    /// @dev Sets up the data point registry and default header
    /// @param _owner Address that will receive the DEFAULT_ADMIN_ROLE
    /// @param _dpr Address of the Data Point Registry contract
    /// @param _defaultHeader Default header info to use when none is specified
    constructor(
        address _owner,
        address _dpr, 
        HeaderInfo memory _defaultHeader
    ) WTTPPermissions(_owner) {
        DPR_ = IDataPointRegistry(_dpr);
        header[bytes32(0)] = _defaultHeader;
    }

    /// @notice Maximum number of methods that can be stored in a header
    /// @dev Used as a bound check for method counts (9 bits max)
    uint16 constant MAX_METHODS = 511;
    
    /// @notice Empty header structure for initialization and reset operations
    HeaderInfo zeroHeader;
    
    /// @notice Empty metadata structure for initialization and reset operations
    ResourceMetadata zeroMetadata;

    /// @notice Reference to the Data Point Registry contract
    /// @dev Used to register data points and access the Data Point Storage
    IDataPointRegistry internal DPR_;

    /// @notice Returns the Data Point Storage contract instance
    /// @dev Accesses DPS through the DPR to maintain proper reference hierarchy
    /// @return IDataPointStorage The Data Point Storage contract
    function DPS() public view virtual returns (IDataPointStorage) {
        return DPR_.DPS_();
    }

    /// @notice Returns the Data Point Registry contract instance
    /// @dev Provides external access to the internal DPR_ reference
    /// @return IDataPointRegistry The Data Point Registry contract
    function DPR() public view virtual returns (IDataPointRegistry) {
        return DPR_;
    }

    /// @notice Updates the Data Point Registry contract address
    /// @dev Restricted to admin role for security
    /// @param _dpr New address for the Data Point Registry contract
    function setDPR(address _dpr) external onlyRole(DEFAULT_ADMIN_ROLE) {
        DPR_ = IDataPointRegistry(_dpr);
    }

    /// @notice Maps header identifiers to header information
    /// @dev Headers contain HTTP-like metadata and access control settings
    mapping(bytes32 header => HeaderInfo) private header;
    
    /// @notice Maps resource paths to their metadata
    /// @dev Metadata includes size, version, timestamps, and header reference
    mapping(string path => ResourceMetadata) private metadata;
    
    /// @notice Maps resource paths to arrays of data point addresses
    /// @dev Each resource is stored as a sequence of data point chunks
    mapping(string path => bytes32[]) private resource;

    /// @notice Prevents modification of immutable resources
    /// @dev Checks if the resource's header has the immutable flag set and if the resource exists
    /// @param _path Path of the resource to check
    modifier notImmutable(string memory _path) {
        if (header[metadata[_path].header].cache.immutableFlag && resource[_path].length > 0) {
            revert ResourceImmutable(_path);
        }
        _;
    }

    // ========== Internal CRUD functions ==========
    
    // ===== Header operations =====
    
    /// @notice Creates a new header in storage
    /// @dev Only creates if header doesn't already exist (methods == 0)
    /// @param _header The header information to store
    /// @return headerAddress The unique identifier for the stored header
    function _createHeader(
        HeaderInfo memory _header
    ) internal virtual returns (bytes32 headerAddress) {
        headerAddress = getHeaderAddress(_header);

        // comparing against methods == 0 will save gas, but this is more accurate
        // if (getHeaderAddress(header[headerAddress]) == getHeaderAddress(zeroHeader)) {
        if (header[headerAddress].methods == 0) {
            header[headerAddress] = _header;
        }
    }

    /// @notice Retrieves header information by its address
    /// @dev Internal view function to access header mapping
    /// @param _headerAddress The unique identifier of the header
    /// @return HeaderInfo The header information
    function _readHeader(
        bytes32 _headerAddress
    ) internal virtual view returns (HeaderInfo memory) {
        return header[_headerAddress];
    }

    /// @notice Sets the default header information
    /// @dev Default header is stored at bytes32(0)
    /// @param _header The header information to use as default
    function _setDefaultHeader(
        HeaderInfo memory _header
    ) internal virtual {
        header[bytes32(0)] = _header;
    }

    // ===== Metadata operations =====
    
    /// @notice Retrieves metadata for a resource path
    /// @dev Internal view function to access metadata mapping
    /// @param _path Path of the resource
    /// @return _metadata Metadata information for the resource
    function _readMetadata(
        string memory _path
    ) internal virtual view returns (ResourceMetadata memory _metadata) {
        _metadata = metadata[_path];
    }

    /// @notice Updates timestamp and version for resource metadata
    /// @dev Internal helper to handle common metadata update operations
    /// @param _path Path of the resource to update
    function _updateMetadataStats(string memory _path) internal virtual {
        // set calculated values
        metadata[_path].lastModified = block.timestamp;
        metadata[_path].version++;

        emit MetadataUpdated(_path);
    }

    /// @notice Updates metadata for a resource
    /// @dev Preserves calculated fields like size, version, and timestamp
    /// @param _path Path of the resource to update
    /// @param _metadata New metadata to store
    function _updateMetadata(
        string memory _path, 
        ResourceMetadata memory _metadata
    ) internal virtual {
        // Update timestamp and version
        _updateMetadataStats(_path);

        // Preserve calculated fields
        _metadata.size = metadata[_path].size;
        _metadata.version = metadata[_path].version;
        _metadata.lastModified = metadata[_path].lastModified;

        metadata[_path] = _metadata;
    }
    
    /// @notice Deletes metadata for a resource
    /// @dev Sets metadata to zero values and emits event
    /// @param _path Path of the resource to delete
    function _deleteMetadata(
        string memory _path
    ) internal virtual {
        _updateMetadata(_path, zeroMetadata);
        emit MetadataDeleted(_path);
    }

    // ===== Resource operations =====
    
    /// @notice Creates a new data point for a resource
    /// @dev Registers the data point in DPR and updates resource mapping
    /// @param _path Path where the resource will be stored
    /// @param _dataRegistration Registration data including content and publisher
    /// @return _dataPointAddress The address of the newly created data point
    function _createResource(
        string memory _path,
        DataRegistration memory _dataRegistration
    ) internal virtual notImmutable(_path) returns (bytes32 _dataPointAddress) {

        _dataPointAddress = DPS().calculateAddress(_dataRegistration.data);

        DPR_.registerDataPoint{value: DPR_.getDataPointRoyalty(_dataPointAddress)}(
            _dataRegistration.data,
            _dataRegistration.publisher
        );

        _updateResource(_path, _dataPointAddress, _dataRegistration.chunkIndex);
    }

    /// @notice Retrieves all data point addresses for a resource
    /// @dev Internal view function to access resource mapping
    /// @param _path Path of the resource
    /// @return Array of data point addresses comprising the resource
    function _readResource(
        string memory _path
    ) internal virtual view returns (bytes32[] memory) {
        return resource[_path];
    }

    /// @notice Updates a specific chunk of a resource
    /// @dev Handles adding new chunks or updating existing ones, updates size calculation
    /// @param _path Path of the resource
    /// @param _dataPointAddress Address of the data point chunk
    /// @param _chunkIndex Index position of the chunk in the resource array
    function _updateResource(
        string memory _path,
        bytes32 _dataPointAddress,
        uint256 _chunkIndex
    ) internal virtual notImmutable(_path) {
        if (_chunkIndex > resource[_path].length) {
            emit OutOfBoundsChunk(_path, _chunkIndex);
        } else if (_chunkIndex == resource[_path].length) {
            // add a new chunk
            resource[_path].push(_dataPointAddress);
            metadata[_path].size += DPS().dataPointSize(_dataPointAddress);
            if (_chunkIndex == 0) emit ResourceCreated(_path);
        } else {
            // update an existing chunk
            // Calculate size delta (new size - old size)
            metadata[_path].size = 
                metadata[_path].size 
                - DPS().dataPointSize(resource[_path][_chunkIndex]) 
                + DPS().dataPointSize(_dataPointAddress);
            resource[_path][_chunkIndex] = _dataPointAddress;
        }

        _updateMetadataStats(_path);
        emit ResourceUpdated(_path, _chunkIndex);
    }

    /// @notice Removes a resource and its metadata
    /// @dev Clears resource array, resets size, and deletes metadata
    /// @param _path Path of the resource to delete
    function _deleteResource(
        string memory _path
    ) internal virtual notImmutable(_path) {
        delete resource[_path];
        metadata[_path].size = 0;
        _deleteMetadata(_path);
        emit ResourceDeleted(_path);
    }

    /// @notice Bulk upload of data points for a resource
    /// @dev Processes an array of data registrations in sequence
    /// @param _path Path of the resource
    /// @param _dataRegistration Array of registration data for multiple chunks
    /// @return _dataPointAddresses Array of addresses for the created data points
    function _uploadResource(
        string memory _path,
        DataRegistration[] memory _dataRegistration
    ) internal virtual notImmutable(_path) returns (bytes32[] memory _dataPointAddresses) {
        _dataPointAddresses = new bytes32[](_dataRegistration.length);
        for (uint i = 0; i < _dataRegistration.length; i++) {
            _dataPointAddresses[i] = _createResource(_path, _dataRegistration[i]);
        }
    }
}
