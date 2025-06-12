// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.20;

import "../../contracts/BaseWTTPSite.sol";

contract TestWTTPSite is BaseWTTPSite {

    constructor(address _owner, address _dpr, HeaderInfo memory _defaultHeader) BaseWTTPSite(_owner, _dpr, _defaultHeader) {}

    function testMethodAllowed(string memory _path, Method _method) public view returns (bool) {
        return _methodAllowed(_path, _method);
    }

    function testGetAuthorizedRole(string memory _path, Method _method) public view returns (bytes32) {
        return _getAuthorizedRole(_path, _method);
    }

    function testIsAuthorized(string memory _path, Method _method, address _account) public view returns (bool) {
        return _isAuthorized(_path, _method, _account);
    }

    function testResourceExists(string memory _path) public view returns (bool) {
        return _resourceExists(_path);
    }

    function testOnlyAuthorized(string memory _path, Method _method) public view onlyAuthorized(_path, _method) returns (bool) {
        return true;
    }

    function testGetDataPoints(DataRegistration[] memory _data) public view returns (bytes32[] memory) {
        return _getDataPoints(_data);
    }

    function testOPTIONS(string memory _path, Method _method) public view returns (OPTIONSResponse memory) {
        return _OPTIONS(_path, _method);
    }

    function testHEAD(HEADRequest memory headRequest, Method _method) public view returns (HEADResponse memory) {
        return _HEAD(headRequest, _method);
    }

    function testGET(LOCATERequest memory getRequest, Method _method) public view returns (LOCATEResponse memory) {
        return _GET(getRequest, _method);
    }
    
    function testNormalizeRange(Range memory range, uint256 size) public pure returns (Range memory) {
        return normalizeRange_(range, size);
    }

    function testCalculateEtag(ResourceMetadata memory metadata, bytes32[] memory dataPoints) public pure returns (bytes32) {
        return calculateEtag(metadata, dataPoints);
    }

    function testGetResourceEtag(string memory path) public view returns (bytes32) {
        return _HEAD(HEADRequest({path: path, ifModifiedSince: 0, ifNoneMatch: bytes32(0)}), Method.HEAD).etag;
    }

    function testSiteSetDefaultHeader(HeaderInfo memory _header) public {
        _setDefaultHeader(_header);
    }
}