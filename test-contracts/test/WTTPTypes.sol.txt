/*
 * Web3 Transfer Protocol (WTTP) - Types and Structures
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

/// @title WTTP Types Contract
/// @notice Defines the types and structures used in the WTTP protocol
/// @dev Provides common definitions for WTTP site and gateway contracts

/// @notice Import the Data Point Storage and Registry interfaces
import "@tw3/esp/contracts/interfaces/IDataPointRegistry.sol";

// ============ WTTP Permissions Contract ============
// ============ Events ============

/// @notice Emitted when the site admin role identifier is changed
/// @param oldSiteAdmin Previous site admin role identifier
/// @param newSiteAdmin New site admin role identifier
event SiteAdminChanged(bytes32 oldSiteAdmin, bytes32 newSiteAdmin);

/// @notice Emitted when a new resource role is created
/// @param role The role identifier that was created
event ResourceRoleCreated(bytes32 indexed role);

// ============ Errors ============

/// @notice Error thrown when an invalid role is used
/// @param role The role identifier that caused the error
error InvalidRole(bytes32 role);

// ============ WTTP Storage Contract ============

// ============ Events ============
// event MalformedParameter(string parameter, bytes value);
// event HeaderExists(bytes32 headerAddress);
// event ResourceExists(string path);
/// @notice Emitted when a chunk index is out of bounds
/// @param path Path of the resource
/// @param chunkIndex Index that was out of bounds
event OutOfBoundsChunk(string path, uint256 chunkIndex);
/// @notice Emitted when resource metadata is updated
/// @param path Path of the updated resource
event MetadataUpdated(string path);
/// @notice Emitted when resource metadata is deleted
/// @param path Path of the deleted metadata
event MetadataDeleted(string path);
/// @notice Emitted when a new resource is created
/// @param path Path of the created resource
event ResourceCreated(string path);
/// @notice Emitted when a resource is updated
/// @param path Path of the updated resource
/// @param chunkIndex Index of the updated chunk
event ResourceUpdated(string path, uint256 chunkIndex);
/// @notice Emitted when a resource is deleted
/// @param path Path of the deleted resource
event ResourceDeleted(string path);

// ============ Errors ============
/// @notice Error thrown when an invalid header is used
/// @param header The header that was invalid
error InvalidHeader(HeaderInfo header);
/// @notice Error thrown when attempting to modify an immutable resource
/// @param path Path of the immutable resource
/// @dev WTTP revert status codes are prefixed with _ so handler can parse the error codes

/// @notice Error thrown when a request is malformed
/// @param reason Reason for the error
/// @param body Body of the error, additional custom context
error _400(string reason, string body);

/// @notice Error thrown when an account lacks permission for a role
/// @param reason Reason for the error
/// @param role Required role for the action
error _403(string reason, bytes32 role);
/// @notice Error thrown when a resource does not exist
/// @param reason Reason for the error
/// @param isImmutable Whether the resource is immutable
error _404(string reason, bool isImmutable);
/// @notice Error thrown when a method is not allowed for a resource
/// @param reason Reason for the error
/// @param methodsAllowed Bitmask of allowed methods
/// @param isImmutable Whether the resource is immutable
error _405(string reason, uint16 methodsAllowed, bool isImmutable);
/// @notice Error thrown when attempting to modify an immutable resource
/// @param reason Reason for the error
/// @param body Body of the error, additional custom context
error _409(string reason, string body);
/// @notice Error thrown when a resource has been permanently deleted
/// @param reason Reason for the error
error _410(string reason);
/// @notice Error thrown when a range is out of bounds
/// @param range The range that was out of bounds
/// @param outOfBounds The index that was out of bounds
error _416(string reason, Range range, int256 outOfBounds);

// ============ Enum Definitions ============

/// @title WTTP Methods Enum
/// @notice Defines supported WTTP methods in the WTTP protocol
/// @dev Used for method-based access control and request handling
enum Method {
    /// @notice Retrieve only resource headers and metadata
    HEAD,
    /// @notice Retrieve resource content
    GET,
    /// @notice Submit data to be processed (not fully implemented in WTTP)
    POST,
    /// @notice Create or replace a resource
    PUT,
    /// @notice Update parts of a resource
    PATCH,
    /// @notice Remove a resource
    DELETE,
    /// @notice Query which methods are supported for a resource
    OPTIONS,
    /// @notice Retrieve storage locations for resource data points
    LOCATE,
    /// @notice Update resource headers
    DEFINE
}

/// @title Cache Preset Enum
/// @notice Defines preset cache control directives
/// @dev Used for resource header management
enum CachePreset {
    /// @notice No cache control directives
    NONE,
    /// @notice Cache control directives for a resource that should not be cached
    NO_CACHE,
    /// @notice Cache control directives for a resource that should be cached
    DEFAULT,
    /// @notice Cache control directives for a resource that should be cached for a short time
    SHORT,
    /// @notice Cache control directives for a resource that should be cached for a medium time
    MEDIUM,
    /// @notice Cache control directives for a resource that should be cached for a long time
    LONG,
    /// @notice Cache control directives for a resource that should be cached indefinitely
    PERMANENT
}

/// @title CORS Policy Presets for Common Use Cases
enum CORSPreset {
    /// @notice No CORS policy
    NONE,           // 0: Use custom configuration only
    /// @notice Public CORS policy
    PUBLIC,         // 1: Wide open - any origin, basic methods
    /// @notice Restricted CORS policy
    RESTRICTED,     // 2: Same-origin only  
    /// @notice API CORS policy
    API,            // 3: Common API configuration
    /// @notice Mixed access CORS policy
    MIXED_ACCESS,   // 4: Public read, restricted write
    /// @notice Private CORS policy
    PRIVATE         // 5: Admin/role access only
}

// ============ Struct Definitions ============

/// @title Cache Control Structure
/// @notice Defines WTTP cache control directives
/// @dev Maps to standard WTTP cache-control header fields
struct CacheControl {
    /// @notice Indicates resource will never change
    bool immutableFlag;
    /// @notice Cache control preset for the client
    CachePreset preset;
    /// @notice Cache control directives for the client, stored as comma separated string eg. "Max-Age=3600, No-Cache"
    /// @dev preset should be NONE if custom is set or it may cause undesired behavior
    string custom;
}
/// @title CORS Policy Structure
/// @notice Defines CORS policy for a resource
/// @dev Used for resource header management
struct CORSPolicy {
    /// @notice Bitmask of allowed methods
    uint16 methods;
    /// @notice Array of access policies for the resource
    /// @dev Each policy is a role identifier use Method enum as index
    bytes32[] origins;
    /// @notice CORS policy preset for the resource
    CORSPreset preset;
    /// @notice String for client side CORS verification
    string custom;
}
/// @title Redirect Structure
/// @notice Defines WTTP redirect information
/// @dev Maps to standard WTTP redirect response
struct Redirect {
    /// @notice WTTP status code for redirect (3xx)
    uint16 code;
    /// @notice Target location for redirect in URL format
    string location; 
}

/// @title Header Information Structure
/// @notice Combines all WTTP header related information
/// @dev Used for resource header management
struct HeaderInfo {
    /// @notice Cache control directives, using CachePreset enum with custom directives if needed
    CacheControl cache;
    /// @notice CORS policy for the resource
    CORSPolicy cors;
    /// @notice Redirect information if applicable
    Redirect redirect;
}

struct ResourceProperties {
    /// @notice MIME type of the resource (2-byte identifier)
    bytes2 mimeType;
    /// @notice Character set of the resource (2-byte identifier)
    bytes2 charset;
    /// @notice Encoding of the resource (2-byte identifier)
    bytes2 encoding;
    /// @notice Language of the resource (2-byte identifier)
    bytes2 language;
}

/// @title Resource Metadata Structure
/// @notice Stores metadata about web resources
/// @dev Used to track resource properties and modifications
struct ResourceMetadata {
    /// @notice Resource properties
    ResourceProperties properties;
    /// @notice Size of the resource in bytes
    uint256 size;
    /// @notice Version number of the resource
    uint256 version;
    /// @notice Timestamp of last modification
    uint256 lastModified;
    /// @notice Header identifier determining which header the resource uses
    bytes32 header;
}

/// @title Data Registration Structure
/// @notice Contains data for registering a resource chunk
/// @dev Used for PUT and PATCH operations
struct DataRegistration {
    /// @notice The actual content data
    bytes data;
    /// @notice Index position in the resource's chunk array
    uint256 chunkIndex;
    /// @notice Address of the content publisher
    address publisher;
}

// ============ Helper Functions ============

// Method Bitmask Converter
// Converts array of methods to a bitmask representation
// Used for efficient method permission storage (1 bit per method)
// methods Array of WTTP methods to convert
// uint16 Bitmask representing allowed methods
function methodsToMask(Method[] memory methods) pure returns (uint16) {
    uint16 mask = 0;
    for (uint i = 0; i < methods.length; i++) {
        mask |= uint16(1 << uint8(methods[i]));
    }
    return mask;
}

// Header Address Calculator
// Calculates a unique address for a header
// Uses keccak256 hash of encoded header information
// _header The header information 
// bytes32 The calculated header address
function getHeaderAddress(HeaderInfo memory _header) pure returns (bytes32) {
    return keccak256(abi.encode(_header));
}

// ============ WTTP Site Contract ============

/// @notice The URI and Query structs are intended for future use

/// @title Query Structure
/// @notice Represents a key-value pair in a URI query string
/// @dev Used for parsing and processing query parameters
// struct Query {
//     /// @notice The key part of the query parameter
//     string key;
//     /// @notice The value part of the query parameter
//     string value;
// }
// /// @title URI Structure
// /// @notice Represents a Uniform Resource Identifier
// /// @dev Used for parsing and processing URIs
// struct URI {
//     /// @notice The path part of the URI
//     string path;
//     /// @notice The query parameters of the URI
//     Query[] query;
//     /// @notice The fragment part of the URI
//     string fragment;
// }

// OPTIONSRequest is just a path string

/// @title OPTIONS Response Structure
/// @notice Contains response data for OPTIONS requests
/// @dev Includes bitmask of allowed methods
struct OPTIONSResponse {
    /// @notice Response status code
    uint16 status;
    /// @notice Bitmask of allowed methods
    uint16 allow;
}

/// @title HEAD Request Structure
/// @notice Contains request data for HEAD requests
/// @dev Includes conditional request headers
struct HEADRequest {
    /// @notice Resource path to request
    string path;
    /// @notice Conditional timestamp for If-Modified-Since header
    uint256 ifModifiedSince;
    /// @notice Conditional ETag for If-None-Match header
    bytes32 ifNoneMatch;
}

/// @title HEAD Response Structure
/// @notice Contains metadata and header information for HEAD requests
/// @dev Used as base response type for other methods
struct HEADResponse {
    /// @notice Response status code
    uint16 status;
    /// @notice Resource header information
    HeaderInfo headerInfo;
    /// @notice Resource metadata
    ResourceMetadata metadata;
    /// @notice Resource content hash for caching
    bytes32 etag;
}

/// @title LOCATE Response Structure
/// @notice Extended response for LOCATE requests
/// @dev Includes storage addresses and data point locations
struct LOCATEResponse {
    /// @notice Base HEAD response
    HEADResponse head;
    /// @notice Array of data point addresses for content chunks
    bytes32[] dataPoints;
}

/// @title PUT Request Structure
/// @notice Contains data for creating or replacing resources
/// @dev Includes metadata and content chunks
struct PUTRequest {
    /// @notice Basic request information
    HEADRequest head;
    /// @notice Properties of the resource
    ResourceProperties properties;
    /// @notice Content chunks to store
    DataRegistration[] data;
}

// PUTResponse is the same as LOCATEResponse

/// @title PATCH Request Structure
/// @notice Contains data for updating parts of resources
/// @dev Includes content chunks to update
struct PATCHRequest {
    /// @notice Basic request information
    HEADRequest head;
    /// @notice Content chunks to update
    DataRegistration[] data;
}

// PATCHResponse is the same as LOCATEResponse

/// @title DEFINE Request Structure
/// @notice Contains data for updating resource headers
/// @dev Includes new header information
struct DEFINERequest {
    /// @notice Basic request information
    HEADRequest head;
    /// @notice New header information
    HeaderInfo data;
}

/// @title DEFINE Response Structure
/// @notice Contains response data for DEFINE requests
/// @dev Includes the new header address
struct DEFINEResponse {
    /// @notice Base HEAD response
    HEADResponse head;
    /// @notice New header address
    bytes32 headerAddress;
}

// ETag Calculator
// Calculates a unique content identifier for caching
// Hashes the combination of metadata and data point addresses
// _metadata Resource metadata
// _dataPoints Array of data point addresses
// bytes32 The calculated ETag
function calculateEtag(
    ResourceMetadata memory _metadata, 
    bytes32[] memory _dataPoints
) pure returns (bytes32) {
    return keccak256(abi.encode(_metadata, _dataPoints));
}

// ============ Gateway Contract ============
/// @title Range Structure
/// @notice Defines a range with start and end positions
/// @dev Supports negative indices (counting from end)
struct Range {
    /// @notice Start position (negative means from end)
    int256 start;
    /// @notice End position (negative means from end, 0 means to end)
    int256 end;
}

/// @title LOCATE Request Structure
/// @notice Extended request for LOCATE with chunk ranges
/// @dev Allows requesting specific ranges of data point chunks
struct LOCATERequest {
    /// @notice Basic request information
    HEADRequest head;
    /// @notice Range of chunks to locate
    Range rangeChunks;
}

/// @title GET Request Structure
/// @notice Extended request for GET with byte ranges
/// @dev Allows requesting specific byte ranges of content
struct GETRequest {
    /// @notice Basic request information
    HEADRequest head;
    /// @notice Range of bytes to retrieve
    Range rangeBytes;
}

/// @title GET Response Structure
/// @notice Contains response data for GET requests
/// @dev Includes content data and metadata
struct GETResponse {
    /// @notice Base HEAD response
    HEADResponse head;
    /// @notice Actual byte range returned
    Range bytesRange;
    /// @notice Content data
    bytes data;
}

// ============ Constants ============

// ============ Functions ============
function maxMethods_() pure returns (uint16) {
    return uint16(type(Method).max) + 1;
}

/// @notice Normalizes an int256 range to be within the total length and positive
/// automatically normalizes 0,0 to 0,totalLength
/// @param range The range to normalize
/// @param totalLength The total length of the resource
/// @return The normalized range
function normalizeRange_(
    Range memory range, 
    uint256 totalLength
) pure returns (Range memory) {

    // if range is -1, 0 treat as 0,0, since 0, 0 is treated as full range
    if (range.start == -1 && range.end == 0) {
        range.start = 0;
        range.end = 0;
    }

    // if the range is 0,0, set the end to the last index for full range
    if (range.end == 0 && range.start == 0) {
        range.end = int256(totalLength) - 1;
        return range;
    }

    // start range is negative, reference from the end of the range
    if (range.start < 0) {
        // if (uint256(-range.start) >= totalLength) {
        //     revert _416("Out of Bounds", range, range.start);
        // }
        range.start = int256(totalLength) - 1 + range.start;
    }
    // start should now be positive if the range wasn't out of bounds

    // if the start or end is greater than the total length -1, range is out of bounds
    // if (range.start >= int256(totalLength) || range.end >= int256(totalLength)) {
    //     revert _416("Out of Bounds", range, int256(totalLength));
    // }

    // end range is negative, reference from the end of the range
    if (range.end < 0) {
        // if (uint256(-range.end) > totalLength - uint256(range.start)) {
        //     revert _416("Out of Bounds", range, range.end);
        // }
        range.end = int256(totalLength) - 1 + range.end;
    }
    // end should now be positive if the range wasn't out of bounds

    // if the start is greater than the end, the range is out of bounds
    // if (range.start > range.end) {
    //     revert _416("Out of Bounds", range, range.start);
    // }

    if (range.start > range.end || range.start < 0 || range.end > int256(totalLength)) {
        revert _416("Out of Bounds", range, range.start);
    }

    // lighter code vs early exit was chosen for now

    return range;
} 

function contentCode_(uint256 resourceSize, uint256 requestedSize) pure returns (uint16) {
    if (requestedSize == 0) {
        return 204;
    }
    if (requestedSize == resourceSize) {
        return 200;
    }
    return 206;
}

/// @notice Emitted when a DEFINE request is successful
/// @param account The account or contract that made the request
/// @param response The response data
event DEFINESuccess(address indexed account, DEFINEResponse response);

/// @notice Emitted when a PUT request is successful
/// @param account The account or contract that made the request
/// @param response The response data
event PUTSuccess(address indexed account, LOCATEResponse response);

/// @notice Emitted when a PATCH request is successful
/// @param account The account or contract that made the request
/// @param response The response data
event PATCHSuccess(address indexed account, LOCATEResponse response);

/// @notice Emitted when a DELETE request is successful
/// @param account The account or contract that made the request
/// @param response The response data
event DELETESuccess(address indexed account, HEADResponse response);