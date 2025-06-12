// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IOwnable {

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    /**
    * @dev The caller account is not authorized to perform an operation.
    */
    error OwnableUnauthorizedAccount(address account);
    /**
    * @dev The owner is not a valid owner account. (eg. `address(0)`)
    */
    error OwnableInvalidOwner(address owner);

    /**
    * @dev Returns the address of the current owner.
    */
    function owner() external view returns (address);
    /**
    * @dev Leaves the contract without owner. It will not be possible to call
    * `onlyOwner` functions. Can only be called by the current owner.
    *
    * NOTE: Renouncing ownership will leave the contract without an owner,
    * thereby disabling any functionality that is only available to the owner.
    */
    function renounceOwnership() external;
    /**
    * @dev Transfers ownership of the contract to a new account (`newOwner`).
    * Can only be called by the current owner.
    */
    function transferOwnership(address newOwner) external;
}
