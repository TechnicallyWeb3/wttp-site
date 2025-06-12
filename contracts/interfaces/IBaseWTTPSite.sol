// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./IBaseWTTPStorage.sol";

/// @title WTTP Base Site Contract
/// @author Web3 Transfer Protocol (WTTP) Development Team
/// @notice Implements core WTTP protocol methods for HTTP-like operations on blockchain
interface IBaseWTTPSite is IBaseWTTPStorage {

    /// @notice Handles OPTIONS requests to check available methods
    /// @dev External interface for _OPTIONS with method enforcement
    /// @param _path Resource path to check
    /// @return optionsResponse Response with allowed methods info
    function OPTIONS(string memory _path) external view returns (OPTIONSResponse memory optionsResponse);
    /// @notice Handles WTTP HEAD requests for metadata
    /// @dev External interface for _HEAD with method enforcement
    /// @param headRequest Request information including conditional headers
    /// @return head Response with header and metadata information
    function HEAD(HEADRequest memory headRequest) external view returns (HEADResponse memory head);
    /// @notice Handles GET requests to retrieve resource content locations
    /// @param getRequest Request information
    /// @return getResponse Response containing resource and storage locations
    function GET(LOCATERequest memory getRequest) external view returns (LOCATEResponse memory getResponse);
    /// @notice Handles DEFINE requests to update resource headers
    /// @dev Only accessible to resource administrators, creates header if needed
    /// @param defineRequest Request information with new header data
    /// @return defineResponse Response containing updated header information
    function DEFINE(DEFINERequest memory defineRequest) external returns (DEFINEResponse memory defineResponse);
    /// @notice Handles DELETE requests to remove resources
    /// @dev Only accessible to resource administrators, checks resource mutability
    /// @param deleteRequest Request information
    /// @return deleteResponse Response confirming deletion
    function DELETE(HEADRequest memory deleteRequest) external returns (HEADResponse memory deleteResponse);
    /// @notice Handles PUT requests to create new resources
    /// @dev Only accessible to resource administrators, transfers any excess payment back
    /// @param putRequest Request information including content data
    /// @return putResponse Response containing created resource information
    function PUT(PUTRequest memory putRequest) external payable returns (LOCATEResponse memory putResponse);
    /// @notice Handles PATCH requests to update existing resources
    /// @dev Only accessible to resource administrators, checks resource mutability
    /// @param patchRequest Request information including update data
    /// @return patchResponse Response containing updated resource information
    function PATCH(PATCHRequest memory patchRequest) external payable returns (LOCATEResponse memory patchResponse);
}
