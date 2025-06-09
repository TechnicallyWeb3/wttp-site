// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.20;

import "../interfaces/IBaseWTTPSite.sol";
import "../BaseWTTPPermissions.sol";
import "@wttp/core/contracts/types/WTTPTypes.sol";

function getSiteDPR_(address _siteAddress) view returns (IDataPointRegistry) {
    return IBaseWTTPSite(_siteAddress).DPR();
}

/// @notice Error thrown when the default origins array is invalid
/// @param _origins The invalid origins
error InvalidOrigins(bytes32[] _origins);

/// @title Extended WTTP Site Contract for Origin Testing
/// @notice Extends BaseWTTPStorage with cross-site origin validation capabilities
/// @dev Acts as a proxy to another WTTP site while enforcing strict origin validation
abstract contract ExtendedWTTPSite is BaseWTTPPermissions {

    /// @notice Reference to the underlying WTTP site being proxied
    IBaseWTTPSite public immutable site;

    bytes32[] public defaultOrigins;

    mapping(string => bytes32[]) public resourceOrigins;
    
    /// @notice Mapping to track allowed origins for cross-site requests
    mapping(address => bool) public allowedOrigins;
    
    /// @notice Event emitted when origins are updated for a path
    event OriginUpdated(string indexed _path, bytes32[] _origins);

    modifier pathNotEmpty(string memory _path) {
        if (bytes(_path).length == 0) {
            revert _400("Bad Request", _path);
        }
        _;
    }
    
    /// @notice Validates that calls are coming from authorized origins
    /// @dev Used for strict cross-site origin testing
    modifier onlyAuthorizedOrigin(string memory _path) {
        bytes32[] memory _origins = bytes(_path).length == 0 ? defaultOrigins : resourceOrigins[_path];
        bytes32 _authorizedRole = _origins[uint256(Method.DEFINE)];
        if (!hasRole(_authorizedRole, msg.sender)) {
            revert _403("Forbidden", _authorizedRole);
        }
        _;
    }

    /// @notice Initializes the extended site with origin validation
    /// @param _owner Address of the contract owner
    /// @param _siteAddress Address of the WTTP site to proxy to
    /// @param _defaultOrigins Default origins for this extension
    constructor(
        address _owner, 
        address _siteAddress, 
        bytes32[] memory _defaultOrigins
    ) BaseWTTPPermissions(_owner) {
        site = IBaseWTTPSite(_siteAddress);
        _setOrigins("", _defaultOrigins);
    }

    function _setOrigins(string memory _path, bytes32[] memory _origins) internal {
        if (_origins.length != maxMethods_()) {
            revert InvalidOrigins(_origins);
        }
        if (bytes(_path).length == 0) {
            defaultOrigins = _origins;
        } else {
            resourceOrigins[_path] = _origins;
        }
        emit OriginUpdated(_path, _origins);
    }

    function setDefaultOrigins(bytes32[] memory _defaultOrigins) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _setOrigins("", _defaultOrigins);
    }

    function setResourceOrigins(string memory _path, bytes32[] memory _origins) external pathNotEmpty(_path) onlyAuthorizedOrigin(_path) {
        _setOrigins(_path, _origins);
    }

    /// @notice Proxy OPTIONS requests with origin validation
    /// @param _path Resource path to check
    /// @return Response from the underlying site
    function OPTIONS(string memory _path) external view onlyAuthorizedOrigin(_path) returns (OPTIONSResponse memory) {
        return site.OPTIONS(_path);
    }

    /// @notice Proxy HEAD requests with origin validation
    /// @param _request HEAD request parameters
    /// @return Response from the underlying site
    function HEAD(HEADRequest memory _request) external view onlyAuthorizedOrigin(_request.path) returns (HEADResponse memory) {
        return site.HEAD(_request);
    }

    /// @notice Proxy GET requests with origin validation
    /// @param _request GET request parameters
    /// @return Response from the underlying site
    function GET(LOCATERequest memory _request) external view onlyAuthorizedOrigin(_request.head.path) returns (LOCATEResponse memory) {
        return site.GET(_request);
    }

    /// @notice Proxy DEFINE requests with origin validation
    /// @param _request DEFINE request parameters
    /// @return Response from the underlying site
    function DEFINE(DEFINERequest memory _request) external onlyAuthorizedOrigin(_request.head.path) returns (DEFINEResponse memory) {
        return site.DEFINE(_request);
    }
    
    /// @notice Proxy DELETE requests with origin validation
    /// @param _request DELETE request parameters
    /// @return Response from the underlying site
    function DELETE(HEADRequest memory _request) external onlyAuthorizedOrigin(_request.path) returns (HEADResponse memory) {
        return site.DELETE(_request);
    }

    /// @notice Proxy PUT requests with origin validation
    /// @param _request PUT request parameters
    /// @return Response from the underlying site
    function PUT(PUTRequest memory _request) external payable onlyAuthorizedOrigin(_request.head.path) returns (LOCATEResponse memory) {
        return site.PUT{value: msg.value}(_request);
    }
    
    /// @notice Proxy PATCH requests with origin validation
    /// @param _request PATCH request parameters
    /// @return Response from the underlying site
    function PATCH(PATCHRequest memory _request) external payable onlyAuthorizedOrigin(_request.head.path) returns (LOCATEResponse memory) {
        return site.PATCH{value: msg.value}(_request);
    }
}
