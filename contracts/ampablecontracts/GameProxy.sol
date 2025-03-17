// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/* ======================================================
   GameProxy
   ------------------------------------------------------
   Upgradeable proxy contract using the EIP-1967 storage slot
   pattern. Delegates all calls to the current logic contract.
   The DAO (owner) can upgrade the implementation and transfer
   ownership.
   ====================================================== */
contract GameProxy {
    // EIP-1967 storage slot for implementation:
    // keccak256("eip1967.proxy.implementation") - 1
    bytes32 private constant IMPLEMENTATION_SLOT =
        0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;

    // Owner of the proxy (DAO)
    address public owner;

    event Upgraded(address indexed newImplementation);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    /// @param _logic Address of the initial logic contract.
    /// @param _owner Address of the DAO (owner).
    /// @param _data Initialization data (if needed, e.g. to call initialize on _logic).
    constructor(address _logic, address _owner, bytes memory _data) payable {
        require(_owner != address(0), "Owner cannot be zero");
        owner = _owner;
        assembly {
            sstore(IMPLEMENTATION_SLOT, _logic)
        }
        emit OwnershipTransferred(address(0), _owner);
        emit Upgraded(_logic);
        if (_data.length > 0) {
            (bool success, ) = _logic.delegatecall(_data);
            require(success, "Initialization failed");
        }
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Caller is not owner");
        _;
    }

    /// @notice Upgrade the implementation contract.
    function upgradeTo(address newImplementation) external onlyOwner {
        require(newImplementation != address(0), "Implementation cannot be zero");
        require(newImplementation != _getImplementation(), "Already using this implementation");
        assembly {
            sstore(IMPLEMENTATION_SLOT, newImplementation)
        }
        emit Upgraded(newImplementation);
    }

    /// @notice Upgrade to new implementation and call initialization.
    function upgradeToAndCall(address newImplementation, bytes calldata data) external onlyOwner {
        upgradeTo(newImplementation);
        if (data.length > 0) {
            (bool success, ) = newImplementation.delegatecall(data);
            require(success, "Call after upgrade failed");
        }
    }

    /// @dev Internal view function to get implementation address.
    function _getImplementation() internal view returns (address impl) {
        assembly {
            impl := sload(IMPLEMENTATION_SLOT)
        }
    }

    fallback() external payable {
        _delegateCall();
    }

    receive() external payable {
        _delegateCall();
    }

    function _delegateCall() internal {
        address impl = _getImplementation();
        require(impl != address(0), "Implementation not set");
        assembly {
            calldatacopy(0, 0, calldatasize())
            let result := delegatecall(gas(), impl, 0, calldatasize(), 0, 0)
            returndatacopy(0, 0, returndatasize())
            switch result
                case 0 { revert(0, returndatasize()) }
                default { return(0, returndatasize()) }
        }
    }
}
