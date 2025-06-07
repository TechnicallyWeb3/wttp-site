// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.20;

import "../WTTPSite.sol";

/// @title Test WTTP Site Contract
/// @notice Concrete implementation of the WTTPSite abstract contract for testing
/// @dev Provides a deployable implementation of the WTTP site with debugging access to internal functions
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

    // ========== Exposed Internal Functions (Not Available Publicly) ==========
    
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

    /// @notice Public wrapper for _methodAllowed
    /// @param _path Resource path to check
    /// @param _method Method type being requested
    /// @return bool True if the method is allowed
    function methodAllowed(string memory _path, Method _method) external view returns (bool) {
        return _methodAllowed(_path, _method);
    }

    /// @notice Public wrapper for _resourceExists
    /// @param _path Path of the resource to check
    /// @return bool True if the resource exists
    function resourceExists(string memory _path) external view returns (bool) {
        return _resourceExists(_path);
    }

    /// @notice Public wrapper for _resourceImmutable
    /// @param _path Path of the resource to check
    /// @return bool True if the resource is immutable
    function resourceImmutable(string memory _path) external view returns (bool) {
        return _resourceImmutable(_path);
    }

    /// @notice Public wrapper for _resourceRequiredPayment
    /// @param _dataRegistration Array of data point registrations
    /// @return uint256 Required payment amount
    function resourceRequiredPayment(DataRegistration[] memory _dataRegistration) external view returns (uint256) {
        return _resourceRequiredPayment(_dataRegistration);
    }

    function normalizeRange(Range memory _range, uint256 _totalLength) external pure returns (Range memory) {
        return _normalizeRange(_range, _totalLength);
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

    // ========== Debugging Helper Functions ==========

    /// @notice Get the ETag for a resource
    /// @param _path Resource path
    /// @return bytes32 The calculated ETag
    function getResourceEtag(string memory _path) external view returns (bytes32) {
        ResourceMetadata memory _metadata = _readMetadata(_path);
        bytes32[] memory resourceData = _readResource(_path, Range(0, 0));
        return calculateEtag(_metadata, resourceData);
    }

    // ========== Essential Storage Access Functions ==========
    
    /// @notice Public access to inherited _readMetadata from WTTPStorage
    /// @param _path Path of the resource
    /// @return ResourceMetadata Metadata information for the resource
    function readMetadata(string memory _path) external view returns (ResourceMetadata memory) {
        return _readMetadata(_path);
    }

    /// @notice Public access to inherited _readHeader from WTTPStorage
    /// @param _path The path of the resource
    /// @return HeaderInfo The header information
    function readHeader(string memory _path) external view returns (HeaderInfo memory) {
        return _readHeader(_path);
    }

    /// @notice Public access to inherited _readResource from WTTPStorage
    /// @param _path Path of the resource
    /// @param _range Range of data to read
    /// @return bytes32[] Array of data point addresses comprising the resource
    function readResource(string memory _path, Range memory _range) external view returns (bytes32[] memory) {
        return _readResource(_path, _range);
    }

    /// @notice Public access to inherited _createHeader from WTTPStorage
    /// @param _header The header information to store
    /// @return bytes32 The unique identifier for the stored header
    function createHeader(HeaderInfo memory _header) external returns (bytes32) {
        return _createHeader(_header);
    }

    /// @notice Public access to inherited _updateMetadata from WTTPStorage
    /// @param _path Path of the resource to update
    /// @param _metadata New metadata to store
    function updateMetadata(string memory _path, ResourceMetadata memory _metadata) external {
        _updateMetadata(_path, _metadata);
    }

    /// @notice Public access to inherited _deleteResource from WTTPStorage
    /// @param _path Path of the resource to delete
    function deleteResource(string memory _path) external {
        _deleteResource(_path);
    }
}