// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.20;

import "./WTTPStorage.sol";
import "./WTTPPermissions.sol";
/// @title WTTP Site Contract
/// @notice Implements core WTTP protocol methods for HTTP-like operations on blockchain
/// @dev Extends WTTPStorageV3 to provide web-like interactions with blockchain resources
///      Implements methods similar to HTTP verbs (GET, PUT, DELETE, etc.)
abstract contract WTTPSiteV3 is WTTPStorageV3 {

    /// @notice Initializes the site contract with necessary dependencies
    /// @dev Sets up DPR and default header, then passes to parent constructor
    /// @param _dpr Address of the Data Point Registry contract
    /// @param _defaultHeader Default header info to use for resources
    /// @param _owner Address that will receive the DEFAULT_ADMIN_ROLE
    constructor(
        address _dpr, 
        HeaderInfo memory _defaultHeader,
        address _owner
    ) WTTPStorageV3(_owner, _dpr, _defaultHeader) {}

    /// @notice Retrieves the resource admin role for a specific path
    /// @dev Reads from the resource's header to get admin role identifier
    /// @param _path Resource path to check
    /// @return bytes32 The resource admin role identifier
    function _getResourceAdmin(string memory _path) internal view returns (bytes32) {   
        return _readHeader(_readMetadata(_path).header).resourceAdmin;
    }

    /// @notice Checks if an account has admin rights for a specific resource
    /// @dev Account has access if they are site admin, resource admin, or the resource allows public access
    /// @param _path Resource path to check
    /// @param _account Account address to verify
    /// @return bool True if the account has admin rights
    function _isResourceAdmin(string memory _path, address _account) internal view returns (bool) {
        bytes32 _resourceAdmin = _getResourceAdmin(_path);
        return hasRole(SITE_ADMIN_ROLE, _account) || 
            hasRole(_resourceAdmin, _account) || 
            _resourceAdmin == bytes32(type(uint256).max); // indicates public access
    }

    /// @notice Restricts function access to resource administrators
    /// @dev Reverts with Forbidden error if caller lacks appropriate permissions
    /// @param _path Resource path being accessed
    modifier onlyResourceAdmin(string memory _path) {
        if (!_isResourceAdmin(_path, msg.sender)) {
            revert Forbidden(msg.sender, _getResourceAdmin(_path));
        }
        _;
    }

    /// @notice Checks WTTP version compatibility
    /// @dev Compares provided version against expected WTTP_VERSION constant
    /// @param _wttpVersion Protocol version to check
    /// @return bool True if version is compatible
    function compatibleWTTPVersion(string memory _wttpVersion) internal pure returns (bool) {
        if(keccak256(abi.encode(_wttpVersion)) == WTTP_VERSION) {
            return true;
        }
        return false;
    }

    /// @notice Updates the default header for the site
    /// @dev Only site admins can modify the default header
    /// @param _header New default header information
    function _updateDefaultHeader(
        HeaderInfo memory _header
    ) external virtual onlyRole(SITE_ADMIN_ROLE) {
        _setDefaultHeader(_header);
    }
    
    /// @notice Determines if a method is allowed for a specific resource
    /// @dev Considers method type, user role, and resource permissions
    /// @param _path Resource path to check
    /// @param _method Method type being requested
    /// @return bool True if the method is allowed
    function _methodAllowed(string memory _path, Method _method) internal view returns (bool) {
        uint16 methodBit = uint16(1 << uint8(_method)); // Create a bitmask for the method
        bool writeMethod = 
            _method == Method.PUT || 
            _method == Method.PATCH || 
            _method == Method.DELETE;
        
        // superAdmin can call any method on any resource, except if the resource is immutable
        if (hasRole(DEFAULT_ADMIN_ROLE, msg.sender)) return true;
        bool _allowed = _readHeader(_readMetadata(_path).header).methods & methodBit != 0;

        return writeMethod ? (
            _isResourceAdmin(_path, msg.sender) &&
            _allowed
        ) : (
            _allowed
        );
    }

    /// @notice Internal implementation of OPTIONS method
    /// @dev Checks protocol version and method permissions
    /// @param optionsRequest Request details including path and protocol
    /// @return optionsResponse Response with allowed methods or error code
    function _OPTIONS(
        RequestLine memory optionsRequest
    ) internal view returns (OPTIONSResponse memory optionsResponse) {
        string memory _protocol = optionsRequest.protocol;
        string memory _path = optionsRequest.path;
        uint16 _code = 500;
        Method _method = optionsRequest.method;
        if (!compatibleWTTPVersion(_protocol)) {
            _code = 505; // HTTP Version Not Supported
        } else if (!_methodAllowed(_path, _method)) {
            _code = 405; // Method Not Allowed
        } else if (_method == Method.OPTIONS) {
            optionsResponse.allow = _readHeader(
                _readMetadata(_path).header
            ).methods;
            _code = 204; // No Content
        }
        optionsResponse.responseLine = ResponseLine({
            protocol: _protocol,
            code: _code
        });
    }

    /// @notice Handles OPTIONS requests to check available methods
    /// @dev External interface for _OPTIONS with method enforcement
    /// @param optionsRequest Request details
    /// @return optionsResponse Response with allowed methods info
    function OPTIONS(
        RequestLine memory optionsRequest
    ) external view returns (OPTIONSResponse memory optionsResponse) {
        optionsRequest.method = Method.OPTIONS;
        optionsResponse = _OPTIONS(optionsRequest);
    }

    /// @notice Internal implementation of HEAD method
    /// @dev Retrieves metadata without content, handles caching and redirects
    /// @param headRequest Request details including conditional headers
    /// @return headResponse Response with metadata and status code
    function _HEAD(
        HEADRequest memory headRequest
    ) internal view returns (HEADResponse memory headResponse) {
        ResponseLine memory _responseLine = _OPTIONS(headRequest.requestLine).responseLine;
        uint16 _code = _responseLine.code;

        if (_code == 500) {
            string memory _path = headRequest.requestLine.path;
            ResourceMetadata memory _metadata = _readMetadata(_path);
            HeaderInfo memory _headerInfo = _readHeader(_metadata.header);
            bytes32 _etag = calculateEtag(_metadata, _readResource(_path));
            uint16 _redirectCode = _headerInfo.redirect.code;
        
            if (_metadata.size == 0) {
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
            // 200 codes should be handled by the parent function
            else if (headRequest.requestLine.method == Method.HEAD) {
                _code = 200; // OK
            }

            _responseLine.code = _code;
            headResponse = HEADResponse({
                responseLine: _responseLine,
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
    )
        external view returns (HEADResponse memory head)
    {
        headRequest.requestLine.method = Method.HEAD;
        return _HEAD(headRequest);
    }

    /// @notice Internal implementation of LOCATE method
    /// @dev Extends HEAD to include data point addresses
    /// @param locateRequest Request details
    /// @return locateResponse Response with metadata and data point locations
    function _LOCATE(
        HEADRequest memory locateRequest
    ) internal view returns (LOCATEResponse memory locateResponse) {
        locateResponse.head = _HEAD(locateRequest);
        
        if (locateResponse.head.responseLine.code == 500) {
            locateResponse.dataPoints = _readResource(locateRequest.requestLine.path);
            locateResponse.head.responseLine.code = 200; // OK
        }
    }

    /// @notice Handles LOCATE requests to find resource storage locations
    /// @dev Returns storage contract address and data point addresses
    /// @param locateRequest Request information
    /// @return locateResponse Response containing storage locations
    function LOCATE(
        HEADRequest memory locateRequest
    )
        external view returns (LOCATEResponse memory locateResponse)
    {
        locateRequest.requestLine.method = Method.LOCATE;
        return _LOCATE(locateRequest);
    }

    /// @notice Handles GET requests to retrieve resources
    /// @dev Equivalent to LOCATE in this implementation (actual data retrieval happens off-chain)
    /// @param getRequest Request information
    /// @return locateResponse Response containing metadata and data point addresses
    function GET(
        HEADRequest memory getRequest
    ) external view returns (LOCATEResponse memory locateResponse) {
        getRequest.requestLine.method = Method.GET;
        return _LOCATE(getRequest);
    }

    /// @notice Handles DEFINE requests to update resource headers
    /// @dev Only accessible to resource administrators, creates header if needed
    /// @param defineRequest Request information with new header data
    /// @return defineResponse Response containing updated header information
    function DEFINE(
        DEFINERequest memory defineRequest
    ) external onlyResourceAdmin(defineRequest.head.requestLine.path) 
    notImmutable(defineRequest.head.requestLine.path) returns (DEFINEResponse memory defineResponse) {
        HEADRequest memory _headRequest = defineRequest.head;
        _headRequest.requestLine.method = Method.DEFINE;
        HEADResponse memory _headResponse = _HEAD(_headRequest);
        uint16 _code = _headResponse.responseLine.code;
        bytes32 _headerAddress;

        if (
            _code == 404 ||
            _code == 500
        ) {
            _headerAddress = _createHeader(defineRequest.data);
            ResourceMetadata memory _metadata = _readMetadata(defineRequest.head.requestLine.path);
            _updateMetadata(defineRequest.head.requestLine.path, ResourceMetadata({
                mimeType: _metadata.mimeType,
                charset: _metadata.charset,
                encoding: _metadata.encoding,
                language: _metadata.language,
                size: 0,
                version: 0,
                lastModified: 0,
                header: _headerAddress
            }));
            _headResponse.responseLine.code = 201; // Created
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
    ) external onlyResourceAdmin(deleteRequest.requestLine.path) 
    notImmutable(deleteRequest.requestLine.path) returns (HEADResponse memory deleteResponse) {
        deleteRequest.requestLine.method = Method.DELETE;
        deleteResponse = _HEAD(deleteRequest);
        if (
            deleteResponse.responseLine.code == 500
        ) {
            _deleteResource(deleteRequest.requestLine.path);
            deleteResponse.responseLine.code = 204; // No Content
        }

        emit DELETESuccess(msg.sender, deleteResponse);
    }

    /// @notice Handles PUT requests to create new resources
    /// @dev Only accessible to resource administrators, transfers any excess payment back
    /// @param putRequest Request information including content data
    /// @return putResponse Response containing created resource information
    function PUT(
        PUTRequest memory putRequest
    ) external payable onlyResourceAdmin(putRequest.head.requestLine.path) 
    returns (LOCATEResponse memory putResponse) {
        putRequest.head.requestLine.method = Method.PUT;
        HEADResponse memory _headResponse = _HEAD(putRequest.head);
        uint16 _code = _headResponse.responseLine.code;
        if (
            _code == 404 ||
            _code == 500
        ) {
            string memory _path = putRequest.head.requestLine.path;
            bytes32 _headerAddress = _readMetadata(_path).header;
            _deleteResource(_path); // delete any existing resource
            _updateMetadata(_path, ResourceMetadata({
                mimeType: putRequest.mimeType,
                charset: putRequest.charset,
                encoding: putRequest.encoding,
                language: putRequest.language,
                size: 0, // calculated during upload
                version: 0, // calculated during upload
                lastModified: 0, // calculated during upload
                header: _headerAddress
            }));
            _code = 204; // No Content
            if (putRequest.data.length > 0) {
                _uploadResource(_path, putRequest.data);
                _code = 201; // Created
            }
            _headResponse.responseLine.code = _code;
        }
        putResponse.head = _headResponse;

        // transfer change back to msg.sender
        if (msg.value > 0) {
            payable(msg.sender).transfer(msg.value);
        }
        emit PUTSuccess(msg.sender, putResponse);
    }

    /// @notice Handles PATCH requests to update existing resources
    /// @dev Only accessible to resource administrators, checks resource mutability
    /// @param patchRequest Request information including update data
    /// @return patchResponse Response containing updated resource information
    function PATCH(
        PATCHRequest memory patchRequest
    ) external payable onlyResourceAdmin(patchRequest.head.requestLine.path) 
    notImmutable(patchRequest.head.requestLine.path) returns (LOCATEResponse memory patchResponse) {
        HEADRequest memory _headRequest = patchRequest.head;
        _headRequest.requestLine.method = Method.PATCH;
        HEADResponse memory _headResponse = _HEAD(_headRequest);

        if (
            _headResponse.responseLine.code == 500 &&
            patchRequest.data.length > 0
        ) {
            patchResponse.dataPoints = _uploadResource(
                _headRequest.requestLine.path, 
                patchRequest.data
            );
            _headResponse.responseLine.code = 200; // OK
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
