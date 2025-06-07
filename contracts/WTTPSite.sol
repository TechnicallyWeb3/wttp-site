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
    
    /// @notice Determines if a method is allowed for a specific resource
    /// @dev Considers method type, user role, and resource permissions
    /// @param _path Resource path to check
    /// @param _method Method type being requested
    /// @return bool True if the method is allowed
    function _methodAllowed(
        string memory _path, 
        Method _method
    ) internal view virtual returns (bool) {
        // super admins can do anything, needed to fix potential site bricking issues
        if (hasRole(DEFAULT_ADMIN_ROLE, msg.sender)) {
            return true;
        }
        
        return _readHeader(_path).cors.methods & uint16(1 << uint8(_method)) != 0;
    }

    /// @notice Retrieves the resource admin role for a specific path
    /// @dev Reads from the resource's header to get admin role identifier
    /// @param _path Resource path to check
    /// @return bytes32 The resource admin role identifier
    function _getAuthorizedRole(
        string memory _path, 
        Method _method
    ) internal view virtual returns (bytes32) {
        bytes32[] memory _origins = _readHeader(_path).cors.origins;
        if (_origins.length == 0) {
            return DEFAULT_ADMIN_ROLE; // default to site admin if no origins are set
        }
        return _origins[uint256(_method)];
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
    ) internal view virtual returns (bool) {
        bytes32 _authorizedRole = _getAuthorizedRole(_path, _method);
        return hasRole(_authorizedRole, _account);
    }

    


    /// @notice Checks if a resource is immutable
    /// @dev Returns true if the resource's header has the immutable flag set and if the resource exists
    /// @param _path Path of the resource to check
    /// @return True if the resource is immutable, false otherwise
    function _resourceImmutable(string memory _path) internal view virtual returns (bool) {
        return _readHeader(_path).cache.immutableFlag && _readMetadata(_path).version > 0;
    }

    /// @notice Checks if a resource exists
    /// @dev Returns true if the resource has at least one data point
    /// @param _path Path of the resource to check
    /// @return True if the resource exists, false otherwise
    function _resourceExists(string memory _path) internal view virtual returns (bool) {
        return _readMetadata(_path).lastModified > 0;
    }

    /// @notice Calculates the royalty for a resource
    /// @dev Returns the total royalty for all data points in the resource
    /// @param _dataRegistration Array of data point registrations
    /// @return _royalty Total royalty for all data points
    function _resourceRequiredPayment(
        DataRegistration[] memory _dataRegistration
    ) internal view virtual returns (uint256 _royalty) {
        for (uint256 i = 0; i < _dataRegistration.length; i++) {
            _royalty += DPR().getDataPointRoyalty(DPS().calculateAddress(_dataRegistration[i].data));
        }
    }

    /// @notice Restricts function access to resource administrators
    /// @dev Reverts with Forbidden error if caller lacks appropriate permissions
    /// @param _path Resource path being accessed
    modifier onlyAuthorized(string memory _path, Method _method) {
        if (!_methodAllowed(_path, _method)) {
            revert _405(
                "Method Not Allowed", // reason
                _readHeader(_path).cors.methods, // methods
                _resourceImmutable(_path) // immutable
            );
        }
        if (_resourceImmutable(_path)) {
            revert _405(
                "Resource Immutable", // reason
                _readHeader(_path).cors.methods, // methods
                true // immutable
            );
        }
        if (!(
            _method == Method.PUT || 
            _method == Method.DEFINE || 
            _method == Method.OPTIONS
        ) && !_resourceExists(_path)) {
            // PUT, DEFINE, and OPTIONS are allowed on non-existent resources
            // client can change to 410 if the resource is immutable
            revert _404("Not Found", _resourceImmutable(_path));
        }
        if (!_isAuthorized(_path, _method, msg.sender)) {
            revert _403("Forbidden", _getAuthorizedRole(_path, _method));
        }
        _;
    }

    function _checkPayment(DataRegistration[] memory _dataRegistration) internal view virtual {
        uint256 _royalty = _resourceRequiredPayment(_dataRegistration);
        if (_royalty > msg.value) {
            revert _402("Insufficient Royalty", _royalty);
        }
    } 

    function _contentCode(uint256 _size, uint256 _totalSize) internal view virtual returns (uint16) {
        if (_size == 0) {
            return 204; // No Content
        } else if (_size == _totalSize) {
            return 200; // OK
        } else {
            return 206; // Partial Content
        }
    }

    function _getDataPoints(
        DataRegistration[] memory _data
    ) internal view virtual returns (bytes32[] memory _dataPoints) {
        uint256 _dataLength = _data.length;
        _dataPoints = new bytes32[](_dataLength);
        for (uint256 i = 0; i < _dataLength; i++) {
            _dataPoints[i] = DPS().calculateAddress(_data[i].data);
        }
    }

    // not a modifier because should be called after onlyAuthorized 
    // which happens on the _OPTIONS call, which happens for all methods
    // used on any payable function

    /// @notice Internal implementation of OPTIONS method
    /// @dev Checks protocol version and method permissions
    /// @param _path Resource path to check
    /// @param _method Method type being requested from the public function
    /// @return optionsResponse Response with allowed methods or error code
    function _OPTIONS(
        string memory _path,
        Method _method
    ) internal view virtual 
    onlyAuthorized(_path, _method) returns (OPTIONSResponse memory optionsResponse) {
        if (_method == Method.OPTIONS) {
            optionsResponse = OPTIONSResponse({
                status: 204,
                allow: _readHeader(_path).cors.methods
            });
        }
        
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
        _OPTIONS(_path, _method); // acts as a check
        ResourceMetadata memory _metadata = _readMetadata(_path);
        HeaderInfo memory _headerInfo = _readHeader(_path);
        bytes32 _etag = calculateEtag(_metadata, _readResource(_path, Range(0, 0)));
        uint16 _status = 500; // Internal Server Error
        if (
            _etag == headRequest.ifNoneMatch ||
            (_metadata.lastModified <= headRequest.ifModifiedSince && 
            _metadata.lastModified > 0)
        ) {
            _status = 304; // Not Modified
        } else if (_headerInfo.redirect.code != 0) {
            _status = _headerInfo.redirect.code;
        }

        if (_status != 500 && _method != Method.DEFINE && _method != Method.DELETE) {
            revert _3xx(Redirect({
                code: _status,
                location: _headerInfo.redirect.location
            }));
        }

        if (_method == Method.HEAD) {
            uint256 _resourceSize = _resourceDataPoints(_path);
            _status = _contentCode(_resourceSize, _resourceSize); 
            // 200 or 204 only, 206 not possible on HEAD since ranged HEAD requests are not supported
        }

        headResponse = HEADResponse({
            status: _status,
            metadata: _metadata,
            headerInfo: _headerInfo,
            etag: _etag
        });
    }

    /// @notice Handles HTTP HEAD requests for metadata
    /// @dev External interface for _HEAD with method enforcement
    /// @param headRequest Request information including conditional headers
    /// @return head Response with header and metadata information
    function HEAD(HEADRequest memory headRequest) external view returns (HEADResponse memory head) {
        head = _HEAD(headRequest, Method.HEAD);
    }

    /// @notice Internal implementation of LOCATE method
    /// @dev Extends HEAD to include data point addresses
    /// @param locateRequest Request details
    /// @return locateResponse Response with metadata and data point locations
    function _LOCATE(
        LOCATERequest memory locateRequest,
        Method _method
    ) internal view returns (LOCATEResponse memory locateResponse) {
        string memory _path = locateRequest.head.path;
        uint256 _resourceSize = _resourceDataPoints(_path);
        
        locateResponse.head = _HEAD(locateRequest.head, _method);
        bytes32[] memory _dataPoints = _readResource(_path, locateRequest.rangeChunks);
        locateResponse.dataPoints = _dataPoints;
        locateResponse.head.status = _contentCode(
            _dataPoints.length, 
            _resourceSize
        );
    }

    /// @notice Handles LOCATE requests to find resource storage locations
    /// @dev Returns storage contract address and data point addresses
    /// @param locateRequest Request information
    /// @return locateResponse Response containing storage locations
    function LOCATE(
        LOCATERequest memory locateRequest
    ) external view returns (LOCATEResponse memory locateResponse) {
        return _LOCATE(locateRequest, Method.LOCATE);
    }

    /// @notice Handles GET requests to retrieve resource content locations
    /// @param getRequest Request information
    /// @return locateResponse Response containing resource and storage locations
    function GET(
        LOCATERequest memory getRequest
    ) external view returns (LOCATEResponse memory locateResponse) {
        return _LOCATE(getRequest, Method.GET);
    }

    /// @notice Handles DEFINE requests to update resource headers
    /// @dev Only accessible to resource administrators, creates header if needed
    /// @param defineRequest Request information with new header data
    /// @return defineResponse Response containing updated header information
    function DEFINE(
        DEFINERequest memory defineRequest
    ) external returns (DEFINEResponse memory defineResponse) {
        string memory _path = defineRequest.head.path;
        _OPTIONS(_path, Method.DEFINE); // acts as a check

        bytes32 _headerAddress = _createHeader(defineRequest.data);
        _updateMetadata(_path, ResourceMetadata({
            properties: _readMetadata(_path).properties, // preserve properties
            size: 0, // calculated during update
            version: 0, // calculated during update
            lastModified: 0, // calculated during update
            header: _headerAddress
        }));

        ResourceMetadata memory _metadata = _readMetadata(_path);

        defineResponse = DEFINEResponse({
            head: HEADResponse({
                status: 200,
                metadata: _metadata,
                headerInfo: _readHeader(_path),
                etag: calculateEtag(_metadata, _readResource(_path, Range(0, 0)))
            }),
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
    ) external returns (HEADResponse memory deleteResponse) {
        string memory _path = deleteRequest.path;
        _OPTIONS(_path, Method.DELETE);
        _deleteResource(_path);

        deleteResponse = _HEAD(deleteRequest, Method.DELETE);
        deleteResponse.status = 204; // No Content

        emit DELETESuccess(msg.sender, deleteResponse);
    }

    /// @notice Handles PUT requests to create new resources
    /// @dev Only accessible to resource administrators, transfers any excess payment back
    /// @param putRequest Request information including content data
    /// @return putResponse Response containing created resource information
    function PUT(
        PUTRequest memory putRequest
    ) external payable returns (LOCATEResponse memory putResponse) {
        string memory _path = putRequest.head.path;
        _OPTIONS(_path, Method.PUT);
        DataRegistration[] memory _data = putRequest.data;
        _checkPayment(_data); // fails early with _402 if insufficient payment
        
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
        uint16 _status = 500; // Internal Server Error
        if (putRequest.data.length > 0) {
            _uploadResource(_path, _data);
            _status = resourceExisted ? 200 : 201; // OK for updates, Created for new resources
        } else {
            _status = 204; // No Content
        }

        putResponse.head = _HEAD(putRequest.head, Method.PUT);
        putResponse.head.status = _status;
        putResponse.dataPoints = _getDataPoints(_data);

        emit PUTSuccess(msg.sender, putResponse);
    }

    /// @notice Handles PATCH requests to update existing resources
    /// @dev Only accessible to resource administrators, checks resource mutability
    /// @param patchRequest Request information including update data
    /// @return patchResponse Response containing updated resource information
    function PATCH(
        PATCHRequest memory patchRequest
    ) external payable returns (LOCATEResponse memory patchResponse) {
        string memory _path = patchRequest.head.path;
        _OPTIONS(_path, Method.PATCH);
        DataRegistration[] memory _data = patchRequest.data;
        _checkPayment(_data); // fails early with _402 if insufficient payment

        patchResponse.dataPoints = _uploadResource(
            _path, 
            _data
        );

        patchResponse.head = _HEAD(patchRequest.head, Method.PATCH);
        patchResponse.head.status = _contentCode(_data.length, _resourceDataPoints(_path));
        patchResponse.dataPoints = _getDataPoints(_data);

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
