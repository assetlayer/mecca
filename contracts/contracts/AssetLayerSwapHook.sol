// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BaseHook} from "@uniswap/v4-periphery/base/hooks/BaseHook.sol";
import {Hooks} from "@uniswap/v4-core/contracts/libraries/Hooks.sol";
import {IHooks} from "@uniswap/v4-core/contracts/interfaces/IHooks.sol";
import {IPoolManager} from "@uniswap/v4-core/contracts/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/contracts/types/PoolKey.sol";
import {BalanceDelta} from "@uniswap/v4-core/contracts/types/BalanceDelta.sol";
import {Currency} from "@uniswap/v4-core/contracts/types/Currency.sol";

/// @title AssetLayerSwapHook
/// @notice Simple Uniswap v4 hook that deducts a protocol fee on every swap and forwards it to a fee recipient.
contract AssetLayerSwapHook is BaseHook {
    event ProtocolFeeCharged(address indexed recipient, Currency indexed currency, uint256 amount);

    address public immutable feeRecipient;
    uint256 public immutable feeE6;

    constructor(IPoolManager _poolManager, address _feeRecipient, uint256 _feeE6)
        BaseHook(_poolManager)
    {
        require(_feeRecipient != address(0), "recipient");
        require(_feeE6 <= 100_000, "fee too high");
        feeRecipient = _feeRecipient;
        feeE6 = _feeE6;
    }

    /// @inheritdoc BaseHook
    function getHookPermissions() public pure override returns (Hooks.Permissions memory) {
        return Hooks.Permissions({
            beforeInitialize: false,
            afterInitialize: false,
            beforeAddLiquidity: false,
            afterAddLiquidity: false,
            beforeRemoveLiquidity: false,
            afterRemoveLiquidity: false,
            beforeSwap: false,
            afterSwap: true,
            beforeDonate: false,
            afterDonate: false
        });
    }

    /// @inheritdoc IHooks
    function afterSwap(
        address,
        PoolKey calldata key,
        IPoolManager.SwapParams calldata params,
        BalanceDelta delta,
        bytes calldata
    ) external override onlyPoolManager returns (bytes4, int128) {
        Currency feeCurrency = params.zeroForOne ? key.currency0 : key.currency1;
        int128 rawDelta = params.zeroForOne ? delta.amount0() : delta.amount1();
        uint256 traded = _abs(rawDelta);
        if (traded > 0 && feeE6 > 0) {
            uint256 feeAmount = (traded * feeE6) / 1_000_000;
            if (feeAmount > 0) {
                poolManager.take(feeCurrency, feeRecipient, feeAmount);
                emit ProtocolFeeCharged(feeRecipient, feeCurrency, feeAmount);
            }
        }

        return (IHooks.afterSwap.selector, 0);
    }

    function _abs(int128 value) internal pure returns (uint256) {
        return uint256(uint128(value < 0 ? -value : value));
    }
}
