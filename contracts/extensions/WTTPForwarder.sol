/*
 * Web3 Transfer Protocol (WTTP) - WTTPStorage Contract
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

import "../BaseWTTPPermissions.sol";
import "@wttp/core/contracts/types/WTTPTypes.sol";

/// @title WTTP Forwarder Contract
/// @notice Stores simple redirect rules for a smart contract and builds minimal WTTP responses
/// @dev Adding this code to an ERC20 contract for example will allow developers to redirect all WTTP calls to an external WTTP site
abstract contract WTTPForwarder {

    uint16 public constant ALLOWED_METHODS = 67; // Bitmask of Method enums [0:HEAD, 1:GET, 6:OPTIONS]

    /// @notice Base URL to redirect requests to
    string public baseURL;

    /// @notice HTTP redirect status code (300-310)
    uint16 public redirectCode;

    uint256 internal lastModified;

    /// @notice Event emitted when redirect configuration is updated
    event RedirectConfigUpdated(string baseURL, uint16 redirectCode);

    /// @notice Error thrown when an invalid redirect code is provided
    /// @param code The invalid redirect code
    error InvalidRedirect(uint16 code);

    /// @notice Error thrown when an empty base URL is provided
    error EmptyBaseURL();

    /// @notice Initializes the forwarder with redirect configuration
    /// @param _baseURL Base URL to redirect to
    /// @dev since the path should include a leading slash, the baseURL should not include a trailing slash
    /// @param _redirectCode HTTP redirect status code (300-310)
    constructor(
        string memory _baseURL,
        uint16 _redirectCode
    ) {
        _setRedirectConfig(_baseURL, _redirectCode);
    }

    // upto developer to add this into their implementation
    // /// @notice Updates the redirect configuration
    // /// @dev Only contract admin can update the configuration
    // /// @param _baseURL New base URL to redirect to
    // /// @param _redirectCode New HTTP redirect status code (300-310)
    // function setRedirectConfig(string memory _baseURL, uint16 _redirectCode) external onlyRole(DEFAULT_ADMIN_ROLE) {
    //     _setRedirectConfig(_baseURL, _redirectCode);
    // }

    /// @notice Internal function to set redirect configuration with validation
    /// @param _baseURL Base URL to redirect to
    /// @param _redirectCode HTTP redirect status code (300-310)
    function _setRedirectConfig(string memory _baseURL, uint16 _redirectCode) internal {
        if (bytes(_baseURL).length == 0) {
            revert EmptyBaseURL();
        }
        
        // Validate redirect code (same validation as BaseWTTPStorage)
        if (_redirectCode != 0 && (_redirectCode < 300 || _redirectCode > 310)) {
            revert InvalidRedirect(_redirectCode);
        }

        baseURL = _baseURL;
        redirectCode = _redirectCode;
        lastModified = block.timestamp;
        emit RedirectConfigUpdated(_baseURL, _redirectCode);
    }

    /// @notice Builds the redirect URL for a given path
    /// @param _path The request path
    /// @return The complete redirect URL
    function _getRedirectURL(string memory _path) internal view returns (string memory) {
        return string(abi.encodePacked(baseURL, _path));
    }

    // ========== WTTP Method Implementations ==========

    /// @notice Handles OPTIONS requests with redirect information
    // / @param _path Resource path to check (unused but kept for interface compatibility)
    /// @return optionsResponse Response with redirect status
    function OPTIONS(string memory /*_path*/) external pure returns (OPTIONSResponse memory optionsResponse) {
        optionsResponse.status = 204;
        optionsResponse.allow = ALLOWED_METHODS;
    }

    /// @notice Handles HEAD requests with redirect information
    /// @param headRequest Request information including path
    /// @return head Response with redirect metadata
    function HEAD(HEADRequest memory headRequest) public view returns (HEADResponse memory head) {
        // Set minimal metadata
        head.metadata.lastModified = lastModified;
        head.metadata.size = 0; // No content, just redirect
        head.metadata.version = 1;

        string memory redirectURL = _getRedirectURL(headRequest.path);
        
        // Generate etag for the redirect
        head.etag = keccak256(abi.encodePacked(redirectCode, redirectURL));

        head.headerInfo.cors.methods = ALLOWED_METHODS;
        
        // Check If-Modified-Since
        if (
            (headRequest.ifModifiedSince > 0 && headRequest.ifModifiedSince > lastModified) || // If-Modified-Since
            (headRequest.ifNoneMatch != bytes32(0) && headRequest.ifNoneMatch == head.etag) // If-None-Match
        ) {
            head.status = 304;
            return head;
        }

        // Return redirect response
        head.headerInfo.redirect = Redirect({
            code: redirectCode,
            location: redirectURL
        });
        return head;
    }

    /// @notice Handles GET requests with redirect information
    /// @param getRequest Request information including path
    /// @return getResponse Response with redirect data
    function GET(LOCATERequest memory getRequest) external view returns (LOCATEResponse memory getResponse) {
        getResponse.head = HEAD(getRequest.head);
    }
}

