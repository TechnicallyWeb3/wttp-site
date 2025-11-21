// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.20;

import "../../contracts/BaseWTTPStorage.sol";
import "../../contracts/BaseWTTPPermissions.sol";

contract TestWTTPStorage is BaseWTTPPermissions, BaseWTTPStorage {

    constructor(address _owner, address _dpr) BaseWTTPStorage(_dpr) BaseWTTPPermissions(_owner) {}

    function testZeroHeader() public view returns (HeaderInfo memory) {
        return zeroHeader;
    }

    function testZeroMetadata() public view returns (ResourceMetadata memory) {
        return zeroMetadata;
    }

    function testCreateHeader(HeaderInfo memory header) public returns (bytes32 headerAddress) {
        return _createHeader(header);
    }

    function testReadHeader(string memory path) public view returns (HeaderInfo memory) {
        return _readHeader(path);
    }

    function testUpdateHeader(bytes32 headerAddress, HeaderInfo memory header) public returns (bool) {
        _updateHeader(headerAddress, header);
        return true;
    }

    function testSetDefaultHeader(HeaderInfo memory header) public returns (bool) {
        _setDefaultHeader(header);
        return true;
    }

    function testReadMetadata(string memory path) public view returns (ResourceMetadata memory) {
        return _readMetadata(path);
    }

    function testUpdateMetadataStats(string memory path) public returns (bool) {
        _updateMetadataStats(path);
        return true;
    }

    function testUpdateMetadata(string memory path, ResourceMetadata memory metadata) public returns (bool) {
        _updateMetadata(path, metadata);
        return true;
    }

    function testDeleteMetadata(string memory path) public returns (bool) {
        _deleteMetadata(path);
        return true;
    }

    function testResourceDataPoints(string memory path) public view returns (uint256) {
        return _resourceDataPoints(path);
    }

    function testCreateResource(string memory path, DataRegistration memory resource) public payable returns (bytes32) {
        return _createResource(path, resource);
    }

    function testReadResource(string memory path, Range memory range) public view returns (ResourceResponse memory) {
        return _readResource(path, range);
    }

    function testUpdateResource(string memory path, bytes32 resource, uint256 chunkIndex) public returns (bool) {
        _updateResource(path, resource, chunkIndex);
        return true;
    }

    function testDeleteResource(string memory path) public returns (bool) {
        _deleteResource(path);
        return true;
    }

    function testUploadResource(string memory path, DataRegistration[] memory dataRegistration) public payable returns (bytes32[] memory) {
        return _uploadResource(path, dataRegistration);
    }

    function testMaxMethods() public pure returns (uint256) {
        return maxMethods_();
    }
}