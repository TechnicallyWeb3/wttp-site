// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.20;

import "./BaseWTTPPermissions.sol";

/// @title WTTP Base Storage Contract
/// @notice Manages web resource storage and access control
/// @dev Core storage functionality for the WTTP protocol, inheriting permission management
///      Resources are stored as chunks of data points with associated metadata and headers
abstract contract BaseWTTPStorage is BaseWTTPPermissions {

    /// @notice Empty header structure for initialization and reset operations
    HeaderInfo zeroHeader;

    /// @notice Empty metadata structure for initialization and reset operations
    ResourceMetadata zeroMetadata;
    // can't be put into the WTTPTypes since it's not a constant and constants don't support structs


    /// @notice Initializes the storage contract with core dependencies and defaults
    /// @dev Sets up the data point registry and default header
    /// @param _owner Address that will receive the DEFAULT_ADMIN_ROLE
    /// @param _dpr Address of the Data Point Registry contract
    constructor(
        address _owner,
        address _dpr
    ) BaseWTTPPermissions(_owner) {
        DPR_ = IDataPointRegistry(_dpr);
    }

    /// @notice Reference to the Data Point Registry contract
    /// @dev Used to register data points and access the Data Point Storage
    IDataPointRegistry private DPR_;

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

    /// @notice Maps header identifiers to header information
    /// @dev Headers contain HTTP-like metadata and access control settings
    mapping(bytes32 header => HeaderInfo) private header;
    
    /// @notice Maps resource paths to their metadata
    /// @dev Metadata includes size, version, timestamps, and header reference
    mapping(string path => ResourceMetadata) private metadata;
    
    /// @notice Maps resource paths to arrays of data point addresses
    /// @dev Each resource is stored as a sequence of data point chunks
    mapping(string path => bytes32[]) private resource;

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
        _updateHeader(headerAddress, _header);
    }

    /// @notice Retrieves header information by its address
    /// @dev Internal view function to access header mapping
    /// @param _path The path of the resource
    /// @return HeaderInfo The header information
    function _readHeader(
        string memory _path
    ) internal virtual view returns (HeaderInfo memory) {
        return header[_readMetadata(_path).header];
    }

    function _updateHeader(bytes32 _headerAddress, HeaderInfo memory _header) internal virtual {
        // Should we apply the same policy of least privilege here as mentioned below?
        // We need to enable OPTIONS, HEAD and GET. Any methods not defined can still be called
        // by the super admin. So making OPTIONS, GET and HEAD available is the minimum
        // requirement... Wait, what if they actually want no public methods? Should we force OPTIONS
        // on as a minimum requirement? No, we should allow the developer to choose. So we should
        // remove this check completely and let the developer decide what methods to allow. This means
        // only they, as super admin, can call all the methods, but until they update the header,
        // the public will always get a _405("Method Not Allowed", methods: 0, immutable: false) error.

        // if (_header.cors.methods == 0) {
        //     _header.cors.methods = MAX_METHODS;
        // } else if (_header.cors.methods > MAX_METHODS) {
        //     revert InvalidHeader(_header);
        // }
        // Should we be more specific and restrictive here?
        // We currently allow anyone in the public to access every method.
        // This means public can PUT, PATCH, DELETE any resource they want.
        // We should include the public role for OPTIONS, HEAD, GET by default but restrict 
        // the POST, PUT, PATCH, DEFINE and DELETE methods to the super admin only.
        // This follows the policy of least privilege as we should.

        // must check redirect code to prevent fake status code injection
        uint16 _redirectCode = _header.redirect.code;
        if (_redirectCode !=0 && (_redirectCode < 300 || _redirectCode > 310)) {
            revert _3xx(_header.redirect);
        }

        // removed automated building of empty origins array to cut bulk

        uint8 _origins = uint8(_header.cors.origins.length);
        if (_origins != maxMethods_()) {
            // needed since origins must exactly match the number of methods,
            // using role bytes32(0) means only admin can access the resource, using role
            // bytes32(max) means the public role can access the resource.
            revert InvalidHeader(_header);
        }
        header[_headerAddress] = _header;
    }

    // was debating on using a _readHeaderByAddress function, but decided against it
    // we don't need this since a HEAD response includes both the header address and the HeaderInfo
    // do we need to get HeaderInfo from a header address?

    // we could add the setDefaultHeader functions to the WTTPSite contract, or omit these entirely
    // to make the contract smaller and allow the developer to choose to update the site's default
    // header in their implementation contract. 

    /// @notice Sets the default header information
    /// @dev Default header is stored at bytes32(0)
    /// @param _header The header information to use as default
    function _setDefaultHeader(HeaderInfo memory _header) internal virtual {
        // should we make the function onlyRole(DEFAULT_ADMIN_ROLE)?
        // this function should be internal only, we don't need to expose it to the public,
        // but if the developer wants to expose it, they should exercise caution,
        // site admins can elevate their permissions if they can access this function,
        // but this needs to be called during at least the constructor of the site contract
        _updateHeader(bytes32(0), _header);
    }

    // /// @notice Updates the default header information
    // /// @dev Only site admins can modify the default header
    // /// @notice Must be elevated above SITE_ADMIN_ROLE, site admins can change the header of any 
    // /// resource they have access to, so we need to be more specific here to avoid security issues
    // /// @param _header The header information to use as default
    // function setDefaultHeader(
    //     HeaderInfo memory _header
    // ) external virtual onlyRole(DEFAULT_ADMIN_ROLE) {
    //     _setDefaultHeader(_header);
    // }

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
        if (resource[_path].length > 0) {
            metadata[_path].version++;
        } else {
            if (metadata[_path].version > 0) {
                // tracking header changes once resource ceases to be empty
                // this allows immutible resources to be written to once 
                // after using the DEFINE method to make the resource immutable
                // if a file currently exists or has existed but since deleted
                // making the resource immutable after it has been deleted 
                // will prevent this "one last chance" to write to the resource
                // it should forever return a 410 Gone error on the client side because
                // the resource is immutable and it can never be written to again
                metadata[_path].version++;
            }
        }
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
        // functions like deleteResource() should set the lastModified to 0 after calling 
        // _deleteMetadata() to ensure the resource returns a 404 Not Found error on chain 
        // or a 410 Gone error in the client if the resource has been made immutable

        metadata[_path] = _metadata;
    }
    
    /// @notice Deletes metadata for a resource
    /// @dev Sets metadata to zero values and emits event
    /// @param _path Path of the resource to delete
    /// @dev this function should only be used by _deleteResource()
    function _deleteMetadata(
        string memory _path
    ) internal virtual {
        // should we check if the resource exists?
        // if it does it may cause issues to have content on a resource with no metadata
        // no we aren't being restrictive in this contract on purpose, let them fuck it up
        // we will do our best to ensure the resource is deleted by never accessing this function
        // from the site contract. Perhaps after testing we could make this function private.
        // For now, let's keep it internal so our test contracts can call it.
        _updateMetadata(_path, zeroMetadata);
        metadata[_path].lastModified = 0;
    }

    // ===== Resource operations =====

    function _resourceDataPoints(string memory _path) internal view virtual returns (uint256) {
        return resource[_path].length;
    }
    
    /// @notice Creates a new data point for a resource
    /// @dev Registers the data point in DPR and updates resource mapping
    /// @param _path Path where the resource will be stored
    /// @param _dataRegistration Registration data including content and publisher
    /// @return _dataPointAddress The address of the newly created data point
    function _createResource(
        string memory _path,
        DataRegistration memory _dataRegistration
    ) internal virtual returns (bytes32 _dataPointAddress) {

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
        string memory _path,
        Range memory _range
    ) internal virtual view returns (bytes32[] memory) { 
        Range memory _normalizedRange = _normalizeRange(_range, _resourceDataPoints(_path));
        uint256 _resourceLength = uint256(_normalizedRange.end - _normalizedRange.start + 1);
        bytes32[] memory _dataPoints = new bytes32[](_resourceLength);
        for (uint256 i = 0; i < _resourceLength; i++) {
            _dataPoints[i] = resource[_path][uint256(_normalizedRange.start) + i];
        }
        return _dataPoints;
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
    ) internal virtual {
        uint256 _resourceLength = _resourceDataPoints(_path);
        if (_chunkIndex > _resourceLength) {
            revert _416("Out of Bounds", Range(0, int256(_resourceLength)), int256(_chunkIndex));
        } else if (_chunkIndex == _resourceLength) {
            // add a new chunk
            resource[_path].push(_dataPointAddress);
            metadata[_path].size += DPS().dataPointSize(_dataPointAddress);
        } else {
            // update an existing chunk
            // Calculate size delta (new size - old size)
            metadata[_path].size = 
                metadata[_path].size 
                + DPS().dataPointSize(_dataPointAddress)
                - DPS().dataPointSize(resource[_path][_chunkIndex]);
            resource[_path][_chunkIndex] = _dataPointAddress;
        }

        _updateMetadataStats(_path);
    }

    /// @notice Removes a resource and its metadata
    /// @dev Clears resource array, resets size, and deletes metadata
    /// @param _path Path of the resource to delete
    function _deleteResource(
        string memory _path
    ) internal virtual {
        delete resource[_path];
        metadata[_path].size = 0;
        _deleteMetadata(_path);
    }

    /// @notice Bulk upload of data points for a resource
    /// @dev Processes an array of data registrations in sequence
    /// @param _path Path of the resource
    /// @param _dataRegistration Array of registration data for multiple chunks
    /// @return _dataPointAddresses Array of addresses for the created data points
    function _uploadResource(
        string memory _path,
        DataRegistration[] memory _dataRegistration
    ) internal virtual returns (bytes32[] memory _dataPointAddresses) {
        _dataPointAddresses = new bytes32[](_dataRegistration.length);
        for (uint i = 0; i < _dataRegistration.length; i++) {
            _dataPointAddresses[i] = _createResource(_path, _dataRegistration[i]);
        }
    }
}
