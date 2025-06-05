// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.20;

import "./WTTPStorage.sol";

/// @title WTTP Site Contract
/// @notice Implements core WTTP protocol methods for HTTP-like operations on blockchain
/// @dev Extends WTTPStorage to provide web-like interactions with blockchain resources
///      Implements methods similar to HTTP verbs (GET, PUT, DELETE, etc.)
abstract contract WTTPSite is WTTPStorage {

    /// @notice Initializes the site contract with necessary dependencies
    /// @dev Sets up DPR and default header, then passes to parent constructor
    /// @param _dpr Address of the Data Point Registry contract
    /// @param _defaultHeader Default header info to use for resources
    /// @param _owner Address that will receive the DEFAULT_ADMIN_ROLE
    constructor(
        address _dpr, 
        HeaderInfo memory _defaultHeader,
        address _owner
    ) WTTPStorage(_owner, _dpr, _defaultHeader) {}

    /// @notice Retrieves the resource admin role for a specific path
    /// @dev Reads from the resource's header to get admin role identifier
    /// @param _path Resource path to check
    /// @return bytes32 The resource admin role identifier
    function _getAuthorizedRole(string memory _path, Method _method) internal view returns (bytes32) {   
        return _readHeader(_path).cors.origins[uint256(_method)];
    }

    /// @notice Checks if an account has admin rights for a specific resource
    /// @dev Account has access if they are site admin, resource admin, or the resource allows public access
    /// @param _path Resource path to check
    /// @param _account Account address to verify
    /// @return bool True if the account has admin rights
    function _isAuthorized(
        string memory _path, 
        Method _method, 
        address _account
    ) internal view returns (bool) {
        bytes32 _authorizedRole = _getAuthorizedRole(_path, _method);
        return hasRole(_authorizedRole, _account);
    }

    /// @notice Restricts function access to resource administrators
    /// @dev Reverts with Forbidden error if caller lacks appropriate permissions
    /// @param _path Resource path being accessed
    modifier onlyAuthorized(string memory _path, Method _method) {
        if (!_methodAllowed(_path, _method)) {
            revert _405(msg.sender, _method, _path);
        }
        if (!_isAuthorized(_path, _method, msg.sender)) {
            revert _403(msg.sender, _getAuthorizedRole(_path, _method), _path);
        }
        _;
    }

    modifier resourceExists(string memory _path) {
        if (!_resourceExists(_path)) {
            if (_resourceGone(_path)) {
                revert _410(_path);
            }
            revert _404(_path);
        }
        _;
    }

    /// @notice Checks if a resource was previously deleted
    /// @dev A resource is considered "gone" if it has version history but no current content
    /// @param _path Resource path to check
    /// @return bool True if the resource was deleted (has version > 0 but no content)
    function _resourceGone(string memory _path) internal view returns (bool) {
        ResourceMetadata memory _metadata = _readMetadata(_path);
        return _metadata.version > 0 && 
               _metadata.size == 0 && 
               _readHeader(_path).cache.immutableFlag;
    }
    
    /// @notice Determines if a method is allowed for a specific resource
    /// @dev Considers method type, user role, and resource permissions
    /// @param _path Resource path to check
    /// @param _method Method type being requested
    /// @return bool True if the method is allowed
    function _methodAllowed(string memory _path, Method _method) internal view returns (bool) {
        uint16 methodBit = uint16(1 << uint8(_method)); // Create a bitmask for the method
        bool _allowed = _readHeader(_path).cors.methods & methodBit != 0;
        return _allowed;
    }

    /// @notice Internal implementation of OPTIONS method
    /// @dev Checks protocol version and method permissions
    /// @param _path Resource path to check
    /// @param _method Method type being requested from the public function
    /// @return optionsResponse Response with allowed methods or error code
    function _OPTIONS(
        string memory _path,
        Method _method
    ) internal view onlyAuthorized(_path, _method) returns (OPTIONSResponse memory optionsResponse) {
        uint16 _code = 500;
        if (!_methodAllowed(_path, _method)) {
            _code = 405; // Method Not Allowed
        } else if (_method == Method.OPTIONS) {
            optionsResponse.allow = _readHeader(_path).cors.methods;
            _code = 204; // No Content
        }
        optionsResponse.status = _code;
    }

    /// @notice Handles OPTIONS requests to check available methods
    /// @dev External interface for _OPTIONS with method enforcement
    /// @param _path Resource path to check
    /// @return optionsResponse Response with allowed methods info
    function OPTIONS(
        string memory _path
    ) external view returns (OPTIONSResponse memory optionsResponse) {
        return _OPTIONS(_path, Method.OPTIONS);
    }

    /// @notice Internal implementation of HEAD method
    /// @dev Retrieves metadata without content, handles caching and redirects
    /// @param headRequest Request details including conditional headers
    /// @return headResponse Response with metadata and status code
    function _HEAD(
        HEADRequest memory headRequest,
        Method _method
    ) internal view returns (HEADResponse memory headResponse) {
        string memory _path = headRequest.path;
        uint16 _code = _OPTIONS(_path, _method).status;

        if (_code == 500) {
            ResourceMetadata memory _metadata = _readMetadata(_path);
            HeaderInfo memory _headerInfo = _readHeader(_path);
            bytes32 _etag = calculateEtag(_metadata, _readResource(_path));
            uint16 _redirectCode = _headerInfo.redirect.code;
        
            if (!_resourceExists(_path)) {
                _code = 404; // Not Found
            } 
            // 3xx codes - conditional responses
            else if (
                _etag == headRequest.ifNoneMatch || 
                headRequest.ifModifiedSince > _metadata.lastModified
            ) {
                _code = 304; // Not Modified
            }
            else if (_redirectCode != 0) {
                _code = _redirectCode; // Redirect
            }
            // HEAD was requested, return 200 and metadata/header config
            else if (_method == Method.HEAD) {
                _code = 200; // OK
            }

            headResponse = HEADResponse({
                status: _code,
                metadata: _metadata,
                headerInfo: _headerInfo,
                etag: _etag
            });
        }
    }

    /// @notice Handles HTTP HEAD requests for metadata
    /// @dev External interface for _HEAD with method enforcement
    /// @param headRequest Request information including conditional headers
    /// @return head Response with header and metadata information
    function HEAD(
        HEADRequest memory headRequest
    ) external view resourceExists(headRequest.path) returns (HEADResponse memory head) {
        return _HEAD(headRequest, Method.HEAD);
    }

    /// @notice Internal implementation of LOCATE method
    /// @dev Extends HEAD to include data point addresses
    /// @param locateRequest Request details
    /// @return locateResponse Response with metadata and data point locations
    function _LOCATE(
        HEADRequest memory locateRequest,
        Method _method
    ) internal view returns (LOCATEResponse memory locateResponse) {
        locateResponse.head = _HEAD(locateRequest, _method);
        
        if (locateResponse.head.status == 500) {
            locateResponse.dataPoints = _readResource(locateRequest.path);
            locateResponse.head.status = 200; // OK
        }
    }

    /// @notice Handles LOCATE requests to find resource storage locations
    /// @dev Returns storage contract address and data point addresses
    /// @param locateRequest Request information
    /// @return locateResponse Response containing storage locations
    function LOCATE(
        HEADRequest memory locateRequest
    ) external view resourceExists(locateRequest.path) returns (LOCATEResponse memory locateResponse) {
        return _LOCATE(locateRequest, Method.LOCATE);
    }

    /// @notice Handles GET requests to retrieve resources
    /// @dev Equivalent to LOCATE in this implementation (actual data retrieval happens off-chain)
    /// @param getRequest Request information
    /// @return getResponse Response containing metadata and data point addresses
    function GET(
        HEADRequest memory getRequest
    ) external view resourceExists(getRequest.path) returns (LOCATEResponse memory getResponse) {
        return _LOCATE(getRequest, Method.GET);
    }

    /// @notice Handles DEFINE requests to update resource headers
    /// @dev Only accessible to resource administrators, creates header if needed
    /// @param defineRequest Request information with new header data
    /// @return defineResponse Response containing updated header information
    function DEFINE(
        DEFINERequest memory defineRequest
    ) external returns (DEFINEResponse memory defineResponse) {
        HEADResponse memory _headResponse = _HEAD(defineRequest.head, Method.DEFINE);
        uint16 _code = _headResponse.status;
        bytes32 _headerAddress;

        if (
            _code == 404 ||
            _code == 500
        ) {
            _headerAddress = _createHeader(defineRequest.data);
            ResourceMetadata memory _metadata = _readMetadata(defineRequest.head.path);
            _updateMetadata(defineRequest.head.path, ResourceMetadata({
                properties: _metadata.properties,
                size: 0,
                version: 0,
                lastModified: 0,
                header: _headerAddress
            }));
            _headResponse.status = 201; // Created
        }
        defineResponse = DEFINEResponse({
            head: _headResponse,
            headerAddress: _headerAddress
        });

        emit DEFINESuccess(msg.sender, defineResponse);
    }

    /// @notice Handles DELETE requests to remove resources
    /// @dev Only accessible to resource administrators, checks resource mutability
    /// @param deleteRequest Request information
    /// @return deleteResponse Response confirming deletion
    function DELETE(
        HEADRequest memory deleteRequest
    ) external resourceExists(deleteRequest.path) returns (HEADResponse memory deleteResponse) {
        deleteResponse = _HEAD(deleteRequest, Method.DELETE);
        if (deleteResponse.status == 500) {
            _deleteResource(deleteRequest.path);
            deleteResponse.status = 204; // No Content
        }

        emit DELETESuccess(msg.sender, deleteResponse);
    }

    /// @notice Handles PUT requests to create new resources
    /// @dev Only accessible to resource administrators, transfers any excess payment back
    /// @param putRequest Request information including content data
    /// @return putResponse Response containing created resource information
    function PUT(
        PUTRequest memory putRequest
    ) external payable onlyAuthorized(putRequest.head.path, Method.PUT) 
    returns (LOCATEResponse memory putResponse) {
        HEADResponse memory _headResponse = _HEAD(putRequest.head, Method.PUT);
        uint16 _code = _headResponse.status;
        if (
            _code == 404 ||
            _code == 500
        ) {
            string memory _path = putRequest.head.path;
            bool resourceExisted = _resourceExists(_path);
            if (resourceExisted) _deleteResource(_path); // delete any existing resource
            _updateMetadata(
                _path, 
                ResourceMetadata({
                    properties: putRequest.properties,
                    size: 0, // calculated during upload
                    version: 0, // calculated during upload
                    lastModified: 0, // calculated during upload
                    header: _readMetadata(_path).header
                })
            );
            if (putRequest.data.length > 0) {
                _uploadResource(_path, putRequest.data);
                _code = resourceExisted ? 200 : 201; // OK for updates, Created for new resources
            } else {
                _code = 204; // No Content
            }
            _headResponse.status = _code;
        }
        putResponse.head = _headResponse;

        emit PUTSuccess(msg.sender, putResponse);
    }

    /// @notice Handles PATCH requests to update existing resources
    /// @dev Only accessible to resource administrators, checks resource mutability
    /// @param patchRequest Request information including update data
    /// @return patchResponse Response containing updated resource information
    function PATCH(
        PATCHRequest memory patchRequest
    ) external payable onlyAuthorized(patchRequest.head.path, Method.PATCH) 
    returns (LOCATEResponse memory patchResponse) {
        HEADResponse memory _headResponse = _HEAD(patchRequest.head, Method.PATCH);

        if (
            _headResponse.status == 500 &&
            patchRequest.data.length > 0
        ) {
            patchResponse.dataPoints = _uploadResource(
                patchRequest.head.path, 
                patchRequest.data
            );
            _headResponse.status = 200; // OK
        }

        patchResponse.head = _headResponse;

        emit PATCHSuccess(msg.sender, patchResponse);
    }

    // ========== Events ==========
    
    /// @notice Emitted when a PATCH request succeeds
    /// @param publisher Address of content publisher
    /// @param patchResponse Response details
    event PATCHSuccess(address indexed publisher, LOCATEResponse patchResponse);

    /// @notice Emitted when a PUT request succeeds
    /// @param publisher Address of content publisher
    /// @param putResponse Response details
    event PUTSuccess(address indexed publisher, LOCATEResponse putResponse);

    /// @notice Emitted when a DELETE request succeeds
    /// @param publisher Address of content publisher
    /// @param deleteResponse Response details
    event DELETESuccess(address indexed publisher, HEADResponse deleteResponse);

    /// @notice Emitted when a DEFINE request succeeds
    /// @param publisher Address of content publisher
    /// @param defineResponse Response details
    event DEFINESuccess(address indexed publisher, DEFINEResponse defineResponse);
}
