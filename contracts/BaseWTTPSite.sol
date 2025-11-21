/*
 * Web3 Transfer Protocol (WTTP) - BaseWTTPSite Contract
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

// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.20;

import "./BaseWTTPStorage.sol";
import "./BaseWTTPPermissions.sol";

/// @title WTTP Base Site Contract
/// @author Web3 Transfer Protocol (WTTP) Development Team
/// @notice Implements core WTTP protocol methods for HTTP-like operations on blockchain
/// @dev Extends WTTPBaseStorage to provide web-like interactions with blockchain resources
abstract contract BaseWTTPSite is BaseWTTPPermissions, BaseWTTPStorage {

    constructor(
        address _owner,
        address _dpr,
        HeaderInfo memory _defaultHeader
    ) BaseWTTPStorage(_dpr) BaseWTTPPermissions(_owner) {
        _setDefaultHeader(_defaultHeader);
    }

    // optional, wait till contract size is reduced
    // /// @notice Sets the default header for the site
    // /// @dev Sets the default header for the site
    // /// @param _defaultHeader The default header to set
    // function setDefaultHeader(HeaderInfo memory _defaultHeader) external virtual {
    //     _setDefaultHeader(_defaultHeader);
    // }

    // internal functions
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

    /// @notice Checks if a resource exists
    /// @dev Returns true if the resource has at least one data point
    /// @param _path Path of the resource to check
    /// @return True if the resource exists, false otherwise
    function _resourceExists(string memory _path) internal view virtual returns (bool) {
        return _readMetadata(_path).lastModified > 0;
    }

    function _isImmutable(string memory _path) internal view virtual returns (bool) {
        return _readHeader(_path).cache.immutableFlag && _readMetadata(_path).version > 0;
    }

    /// @notice Restricts function access to resource administrators
    /// @dev Reverts with Forbidden error if caller lacks appropriate permissions
    /// @param _path Resource path being accessed
    modifier onlyAuthorized(string memory _path, Method _method) {
        if (!_methodAllowed(_path, _method)) {
            revert _405("Method Not Allowed", _readHeader(_path).cors.methods, _readHeader(_path).cache.immutableFlag);
        }

        if (_isImmutable(_path)) {
            revert _405("Resource Immutable", _readHeader(_path).cors.methods, true);
        }

        if (!(
            _method == Method.PUT || 
            _method == Method.DEFINE || 
            _method == Method.OPTIONS
        ) && !_resourceExists(_path)) {
            // PUT, DEFINE, and OPTIONS are allowed on non-existent resources
            // client can change to 410 if the resource is immutable
            revert _404("Not Found", _readHeader(_path).cache.immutableFlag);
        }
        if (!_isAuthorized(_path, _method, msg.sender)) {
            revert _403("Forbidden", _getAuthorizedRole(_path, _method));
        }
        _;
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
        bytes32 _etag = calculateEtag(_metadata, _readResource(_path, Range(0, 0)).dataPoints);
        uint16 _status = 500; // Internal Server Error
        if (
            _etag == headRequest.ifNoneMatch ||
            (_metadata.lastModified <= headRequest.ifModifiedSince && 
            _metadata.lastModified > 0)
        ) {
            _status = 304; // Not Modified
        } else if (_headerInfo.redirect.code != 0) {
            _status = _headerInfo.redirect.code;
        } else if (_method == Method.HEAD) {
            uint256 _resourceSize = _resourceDataPoints(_path);
            _status = contentCode_(_resourceSize, _resourceSize); 
            // 200 or 204 only, 206 not possible on HEAD since ranged HEAD requests are not supported
        }

        headResponse = HEADResponse({
            status: _status,
            metadata: _metadata,
            headerInfo: _headerInfo,
            etag: _etag
        });
    }

    /// @notice Handles WTTP HEAD requests for metadata
    /// @dev External interface for _HEAD with method enforcement
    /// @param headRequest Request information including conditional headers
    /// @return head Response with header and metadata information
    function HEAD(HEADRequest memory headRequest) external view returns (HEADResponse memory head) {
        head = _HEAD(headRequest, Method.HEAD);
    }

    /// @notice Internal implementation of LOCATE method
    /// @dev Extends HEAD to include data point addresses
    /// @param getRequest Request details
    /// @return getResponse Response with metadata and data point locations
    function _GET(
        LOCATERequest memory getRequest,
        Method _method
    ) internal view returns (LOCATEResponse memory getResponse) {
        string memory _path = getRequest.head.path;
        HEADResponse memory _head = _HEAD(getRequest.head, _method); // includes error check
        
        // design choice, do we allow content to be returned even if the resource is not found?
        // if so all we need to do is add this datapoint to the 500 code check. 
        ResourceResponse memory _resource = _readResource(_path, getRequest.rangeChunks);
        getResponse.resource = _resource;

        if (_head.status == 500) {
            _head.status = contentCode_(
                _resource.dataPoints.length, 
                _resource.totalChunks
            );
        }

        getResponse.head = _head;
    }

    /// @notice Handles GET requests to retrieve resource content locations
    /// @param getRequest Request information
    /// @return getResponse Response containing resource and storage locations
    function GET(
        LOCATERequest memory getRequest
    ) external view returns (LOCATEResponse memory getResponse) {
        return _GET(getRequest, Method.GET);
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
        bytes32[] memory _dataPoints = _readResource(_path, Range(0, 0)).dataPoints;

        defineResponse = DEFINEResponse({
            head: HEADResponse({
                status: 200,
                metadata: _metadata,
                headerInfo: _readHeader(_path),
                etag: calculateEtag(_metadata, _dataPoints)
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
        _OPTIONS(_path, Method.DELETE); // acts as a check
        _deleteResource(_path);
        ResourceMetadata memory _metadata = _readMetadata(_path);

        deleteResponse = HEADResponse({
            status: 204,
            metadata: _metadata,
            headerInfo: _readHeader(_path),
            etag: calculateEtag(_metadata, new bytes32[](0)) // empty array since deleted
        });

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
        _OPTIONS(_path, Method.PUT); // error check
        DataRegistration[] memory _data = putRequest.data;
        uint16 _status = 500; // Internal Server Error
        bool resourceExisted = _resourceExists(_path);
        bytes32 _headerAddress = _readMetadata(_path).header;
        if (resourceExisted) _deleteResource(_path); // delete any existing resource
        if (putRequest.data.length > 0) {
            _uploadResource(_path, _data);
            _status = resourceExisted ? 200 : 201; // OK for updates, Created for new resources
        } else {
            _status = 204; // No Content
        }
        _updateMetadata(
            _path, 
            ResourceMetadata({
                properties: putRequest.properties,
                size: 0, // calculated during upload
                version: 0, // calculated during upload
                lastModified: 0, // calculated during upload
                header: _headerAddress // preserve header
            })
        );

        ResourceMetadata memory _metadata = _readMetadata(_path);
        bytes32[] memory _dataPoints = _getDataPoints(_data);

        putResponse.head = HEADResponse({
            status: _status,
            metadata: _metadata, // use updated metadata
            headerInfo: _readHeader(_path),
            etag: calculateEtag(_metadata, _dataPoints)
        });
        putResponse.resource = ResourceResponse({
            dataPoints: _dataPoints,
            totalChunks: _data.length
        });

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

        bytes32[] memory _dataPoints = _uploadResource(
            _path, 
            _data
        );

        patchResponse.head = _HEAD(patchRequest.head, Method.PATCH);
        patchResponse.head.status = contentCode_(_dataPoints.length, _resourceDataPoints(_path));
        patchResponse.resource = ResourceResponse({
            dataPoints: _dataPoints,
            totalChunks: _resourceDataPoints(_path)
        });

        emit PATCHSuccess(msg.sender, patchResponse);
    }
}