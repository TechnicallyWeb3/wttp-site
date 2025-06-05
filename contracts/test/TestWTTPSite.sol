// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.20;

import "../WTTPSite.sol";

/// @title Test WTTP Site Contract
/// @notice Concrete implementation of the WTTPSite abstract contract for testing
/// @dev Provides a deployable implementation of the WTTP site with full debugging access to internal functions
contract TestWTTPSite is WTTPSite {

    /// @notice Initializes the site contract with necessary dependencies
    /// @dev Sets up DPR and default header, then passes to parent constructor
    /// @param _dpr Address of the Data Point Registry contract
    /// @param _defaultHeader Default header info to use for resources
    /// @param _owner Address that will receive the DEFAULT_ADMIN_ROLE
    constructor(
        address _dpr, 
        HeaderInfo memory _defaultHeader,
        address _owner
    ) WTTPSite(_dpr, _defaultHeader, _owner) {}

    // ========== Exposed Internal Functions ==========
    
    /// @notice Public wrapper for _getAuthorizedRole
    /// @param _path Resource path to check
    /// @param _method Method type being requested
    /// @return bytes32 The resource admin role identifier
    function getAuthorizedRole(string memory _path, Method _method) external view returns (bytes32) {   
        return _getAuthorizedRole(_path, _method);
    }

    /// @notice Public wrapper for _isAuthorized
    /// @param _path Resource path to check
    /// @param _method Method type being requested
    /// @param _account Account address to verify
    /// @return bool True if the account has admin rights
    function isAuthorized(
        string memory _path, 
        Method _method, 
        address _account
    ) external view returns (bool) {
        return _isAuthorized(_path, _method, _account);
    }

    /// @notice Public wrapper for _resourceGone
    /// @param _path Resource path to check
    /// @return bool True if the resource was deleted
    function resourceGone(string memory _path) external view returns (bool) {
        return _resourceGone(_path);
    }

    /// @notice Public wrapper for _methodAllowed
    /// @param _path Resource path to check
    /// @param _method Method type being requested
    /// @return bool True if the method is allowed
    function methodAllowed(string memory _path, Method _method) external view returns (bool) {
        return _methodAllowed(_path, _method);
    }

    /// @notice Public wrapper for _OPTIONS
    /// @param _path Resource path to check
    /// @param _method Method type being requested
    /// @return optionsResponse Response with allowed methods or error code
    function testOPTIONS(
        string memory _path,
        Method _method
    ) external view returns (OPTIONSResponse memory optionsResponse) {
        return _OPTIONS(_path, _method);
    }

    /// @notice Public wrapper for _HEAD
    /// @param headRequest Request details including conditional headers
    /// @param _method Method type being requested
    /// @return headResponse Response with metadata and status code
    function testHEAD(
        HEADRequest memory headRequest,
        Method _method
    ) external view returns (HEADResponse memory headResponse) {
        return _HEAD(headRequest, _method);
    }

    /// @notice Public wrapper for _LOCATE
    /// @param locateRequest Request details
    /// @param _method Method type being requested
    /// @return locateResponse Response with metadata and data point locations
    function testLOCATE(
        HEADRequest memory locateRequest,
        Method _method
    ) external view returns (LOCATEResponse memory locateResponse) {
        return _LOCATE(locateRequest, _method);
    }

    // ========== Exposed Modifiers ==========
    
    /// @notice Test the onlyAuthorized modifier
    /// @param _path Resource path being accessed
    /// @param _method Method type being requested
    function testOnlyAuthorizedModifier(string memory _path, Method _method) external view onlyAuthorized(_path, _method) {
        // This function will revert if caller lacks appropriate permissions
    }

    /// @notice Test the resourceExists modifier
    /// @param _path Resource path to check
    function testResourceExistsModifier(string memory _path) external view resourceExists(_path) {
        // This function will revert if resource doesn't exist
    }

    // ========== Debugging Helper Functions ==========
    
    /// @notice Check what the onlyAuthorized modifier would do without calling it
    /// @param _path Resource path being accessed
    /// @param _method Method type being requested
    /// @param _account Account to check authorization for
    /// @return authorized True if authorized
    /// @return methodAllowed_ True if method is allowed
    /// @return authorizedRole The role that has access
    function checkAuthorization(
        string memory _path, 
        Method _method, 
        address _account
    ) external view returns (bool authorized, bool methodAllowed_, bytes32 authorizedRole) {
        methodAllowed_ = _methodAllowed(_path, _method);
        authorizedRole = _getAuthorizedRole(_path, _method);
        authorized = _isAuthorized(_path, _method, _account);
    }

    /// @notice Check what the resourceExists modifier would do without calling it
    /// @param _path Resource path to check
    /// @return exists True if resource exists
    /// @return gone True if resource was deleted (gone)
    /// @return wouldRevert True if the modifier would revert
    /// @return errorCode HTTP error code that would be thrown (404 or 410)
    function checkResourceExists(string memory _path) external view returns (
        bool exists, 
        bool gone, 
        bool wouldRevert, 
        uint16 errorCode
    ) {
        exists = _resourceExists(_path);
        gone = _resourceGone(_path);
        wouldRevert = !exists;
        
        if (!exists) {
            errorCode = gone ? 410 : 404;
        } else {
            errorCode = 0;
        }
    }

    /// @notice Test method bits for a given method
    /// @param _method The method to get the bit for
    /// @return uint16 The method bit mask
    function getMethodBit(Method _method) external pure returns (uint16) {
        return uint16(1 << uint8(_method));
    }

    /// @notice Check if a specific method bit is set in a methods bitmask
    /// @param _methods The methods bitmask
    /// @param _method The method to check
    /// @return bool True if the method is allowed
    function isMethodBitSet(uint16 _methods, Method _method) external pure returns (bool) {
        uint16 methodBit = uint16(1 << uint8(_method));
        return _methods & methodBit != 0;
    }

    /// @notice Get the ETag for a resource
    /// @param _path Resource path
    /// @return bytes32 The calculated ETag
    function getResourceEtag(string memory _path) external view returns (bytes32) {
        ResourceMetadata memory _metadata = _readMetadata(_path);
        bytes32[] memory resourceData = _readResource(_path);
        return calculateEtag(_metadata, resourceData);
    }

    /// @notice Test conditional request logic
    /// @param _path Resource path
    /// @param _ifNoneMatch ETag for if-none-match header
    /// @param _ifModifiedSince Timestamp for if-modified-since header
    /// @return notModified True if resource was not modified
    /// @return currentEtag Current ETag of the resource
    /// @return lastModified Last modified timestamp
    function testConditionalRequest(
        string memory _path,
        bytes32 _ifNoneMatch,
        uint256 _ifModifiedSince
    ) external view returns (bool notModified, bytes32 currentEtag, uint256 lastModified) {
        ResourceMetadata memory _metadata = _readMetadata(_path);
        bytes32[] memory resourceData = _readResource(_path);
        currentEtag = calculateEtag(_metadata, resourceData);
        lastModified = _metadata.lastModified;
        
        notModified = (currentEtag == _ifNoneMatch) || (_ifModifiedSince > lastModified);
    }

    // ========== Access to Inherited Functions ==========
    
    /// @notice Public access to inherited _resourceExists from WTTPStorage
    /// @param _path Path of the resource to check
    /// @return bool True if the resource exists
    function resourceExistsPublic(string memory _path) external view returns (bool) {
        return _resourceExists(_path);
    }

    /// @notice Public access to inherited _readMetadata from WTTPStorage
    /// @param _path Path of the resource
    /// @return ResourceMetadata Metadata information for the resource
    function readMetadataPublic(string memory _path) external view returns (ResourceMetadata memory) {
        return _readMetadata(_path);
    }

    /// @notice Public access to inherited _readHeader from WTTPStorage
    /// @param _path The path of the resource
    /// @return HeaderInfo The header information
    function readHeaderPublic(string memory _path) external view returns (HeaderInfo memory) {
        return _readHeader(_path);
    }

    /// @notice Public access to inherited _readResource from WTTPStorage
    /// @param _path Path of the resource
    /// @return bytes32[] Array of data point addresses comprising the resource
    function readResourcePublic(string memory _path) external view returns (bytes32[] memory) {
        return _readResource(_path);
    }

    /// @notice Public access to inherited _createHeader from WTTPStorage
    /// @param _header The header information to store
    /// @return bytes32 The unique identifier for the stored header
    function createHeaderPublic(HeaderInfo memory _header) external returns (bytes32) {
        return _createHeader(_header);
    }

    /// @notice Public access to inherited _updateMetadata from WTTPStorage
    /// @param _path Path of the resource to update
    /// @param _metadata New metadata to store
    function updateMetadataPublic(string memory _path, ResourceMetadata memory _metadata) external {
        _updateMetadata(_path, _metadata);
    }

    /// @notice Public access to inherited _deleteResource from WTTPStorage
    /// @param _path Path of the resource to delete
    function deleteResourcePublic(string memory _path) external {
        _deleteResource(_path);
    }

    /// @notice Public access to inherited _uploadResource from WTTPStorage
    /// @param _path Path of the resource
    /// @param _dataRegistration Array of registration data for multiple chunks
    /// @return bytes32[] Array of addresses for the created data points
    function uploadResourcePublic(
        string memory _path,
        DataRegistration[] memory _dataRegistration
    ) external payable returns (bytes32[] memory) {
        return _uploadResource(_path, _dataRegistration);
    }

    // ========== Additional Test Utilities ==========
    
    /// @notice Simulate a complete HTTP request flow for testing
    /// @param _path Resource path
    /// @param _method HTTP method
    /// @param _account Account making the request
    /// @return statusCode HTTP status code that would be returned
    /// @return authorized Whether the request would be authorized
    /// @return resourceExists_ Whether the resource exists
    function simulateRequest(
        string memory _path,
        Method _method,
        address _account
    ) external view returns (uint16 statusCode, bool authorized, bool resourceExists_) {
        resourceExists_ = _resourceExists(_path);
        
        if (!_methodAllowed(_path, _method)) {
            return (405, false, resourceExists_); // Method Not Allowed
        }
        
        authorized = _isAuthorized(_path, _method, _account);
        if (!authorized) {
            return (403, false, resourceExists_); // Forbidden
        }
        
        if (!resourceExists_) {
            if (_resourceGone(_path)) {
                return (410, authorized, resourceExists_); // Gone
            }
            return (404, authorized, resourceExists_); // Not Found
        }
        
        return (200, authorized, resourceExists_); // OK
    }

    /// @notice Get all information about a resource in one call
    /// @param _path Resource path
    /// @return metadata Resource metadata
    /// @return headerInfo Header information
    /// @return dataPoints Array of data point addresses
    /// @return etag Calculated ETag
    function getCompleteResourceInfo(string memory _path) external view returns (
        ResourceMetadata memory metadata,
        HeaderInfo memory headerInfo,
        bytes32[] memory dataPoints,
        bytes32 etag
    ) {
        metadata = _readMetadata(_path);
        headerInfo = _readHeader(_path);
        dataPoints = _readResource(_path);
        etag = calculateEtag(metadata, dataPoints);
    }
}