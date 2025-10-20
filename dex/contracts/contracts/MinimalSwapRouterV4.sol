// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IUnlockCallback} from "@uniswap/v4-core/src/interfaces/callback/IUnlockCallback.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {Currency, CurrencyLibrary} from "@uniswap/v4-core/src/types/Currency.sol";
import {ERC20} from "solmate/src/tokens/ERC20.sol";
import {SafeTransferLib} from "solmate/src/utils/SafeTransferLib.sol";

/// @notice Minimal swap router that interacts with the Uniswap v4 PoolManager and custom hook.
contract MinimalSwapRouterV4 is IUnlockCallback {
    using CurrencyLibrary for Currency;
    using SafeTransferLib for ERC20;

    enum CommandType {
        SWAP_EXACT_IN,
        SWAP_EXACT_OUT
    }

    struct SwapExactInputParams {
        PoolKey key;
        uint256 amountIn;
        uint256 amountOutMin;
        address recipient;
        address payer;
        bool zeroForOne;
        uint160 sqrtPriceLimitX96;
        uint256 deadline;
    }

    struct SwapExactOutputParams {
        PoolKey key;
        uint256 amountOut;
        uint256 amountInMax;
        address recipient;
        address payer;
        bool zeroForOne;
        uint160 sqrtPriceLimitX96;
        uint256 deadline;
    }

    IPoolManager public immutable poolManager;

    event SwapExecuted(address indexed sender, address indexed recipient, bool zeroForOne, uint256 amountIn, uint256 amountOut);

    error DeadlinePassed();
    error TooMuchRequested();
    error InvalidCaller();
    error NativeCurrencyNotSupported();

    constructor(IPoolManager _poolManager) {
        poolManager = _poolManager;
    }

    function swapExactInput(SwapExactInputParams calldata params) external returns (uint256 amountOut) {
        if (params.deadline < block.timestamp) revert DeadlinePassed();
        bytes memory result = poolManager.unlock(abi.encode(CommandType.SWAP_EXACT_IN, params, msg.sender));
        amountOut = abi.decode(result, (uint256));
        if (amountOut < params.amountOutMin) revert TooMuchRequested();
        emit SwapExecuted(msg.sender, params.recipient, params.zeroForOne, params.amountIn, amountOut);
    }

    function swapExactOutput(SwapExactOutputParams calldata params) external returns (uint256 amountIn) {
        if (params.deadline < block.timestamp) revert DeadlinePassed();
        bytes memory result = poolManager.unlock(abi.encode(CommandType.SWAP_EXACT_OUT, params, msg.sender));
        amountIn = abi.decode(result, (uint256));
        if (amountIn > params.amountInMax) revert TooMuchRequested();
        emit SwapExecuted(msg.sender, params.recipient, params.zeroForOne, amountIn, params.amountOut);
    }

    /// @inheritdoc IUnlockCallback
    function unlockCallback(bytes calldata data) external override returns (bytes memory) {
        if (msg.sender != address(poolManager)) revert InvalidCaller();
        (CommandType command, bytes memory payload, address caller) = abi.decode(data, (CommandType, bytes, address));

        if (command == CommandType.SWAP_EXACT_IN) {
            SwapExactInputParams memory params = abi.decode(payload, (SwapExactInputParams));
            return _performSwapExactIn(params, caller);
        }
        if (command == CommandType.SWAP_EXACT_OUT) {
            SwapExactOutputParams memory params = abi.decode(payload, (SwapExactOutputParams));
            return _performSwapExactOut(params, caller);
        }

        revert InvalidCaller();
    }

    function _performSwapExactIn(SwapExactInputParams memory params, address caller) internal returns (bytes memory) {
        if (params.deadline < block.timestamp) revert DeadlinePassed();
        Currency inputCurrency = params.zeroForOne ? params.key.currency0 : params.key.currency1;
        Currency outputCurrency = params.zeroForOne ? params.key.currency1 : params.key.currency0;

        address payer = params.payer == address(0) ? caller : params.payer;
        _settle(inputCurrency, payer, params.amountIn);

        SwapParams memory swapParams = SwapParams({
            zeroForOne: params.zeroForOne,
            amountSpecified: int256(params.amountIn),
            sqrtPriceLimitX96: params.sqrtPriceLimitX96
        });

        BalanceDelta delta = poolManager.swap(params.key, swapParams, abi.encode(caller));
        int128 outputDelta = params.zeroForOne ? delta.amount1() : delta.amount0();
        uint256 amountOut = _toPositive(outputDelta);

        poolManager.take(outputCurrency, params.recipient, amountOut);

        return abi.encode(amountOut);
    }

    function _performSwapExactOut(SwapExactOutputParams memory params, address caller) internal returns (bytes memory) {
        if (params.deadline < block.timestamp) revert DeadlinePassed();
        Currency inputCurrency = params.zeroForOne ? params.key.currency0 : params.key.currency1;
        Currency outputCurrency = params.zeroForOne ? params.key.currency1 : params.key.currency0;

        SwapParams memory swapParams = SwapParams({
            zeroForOne: params.zeroForOne,
            amountSpecified: -int256(params.amountOut),
            sqrtPriceLimitX96: params.sqrtPriceLimitX96
        });

        BalanceDelta delta = poolManager.swap(params.key, swapParams, abi.encode(caller));

        int128 inputDelta = params.zeroForOne ? delta.amount0() : delta.amount1();
        uint256 amountIn = _toPositive(inputDelta);
        if (amountIn > params.amountInMax) revert TooMuchRequested();

        address payer = params.payer == address(0) ? caller : params.payer;
        _settle(inputCurrency, payer, amountIn);

        poolManager.take(outputCurrency, params.recipient, params.amountOut);
        return abi.encode(amountIn);
    }

    function _toPositive(int128 value) private pure returns (uint256) {
        return uint256(uint128(value < 0 ? -value : value));
    }

    function _settle(Currency currency, address payer, uint256 amount) private {
        if (amount == 0) return;

        poolManager.sync(currency);

        if (currency.isAddressZero()) revert NativeCurrencyNotSupported();

        ERC20 token = ERC20(Currency.unwrap(currency));
        if (payer != address(this)) {
            token.safeTransferFrom(payer, address(this), amount);
        }
        token.safeTransfer(address(poolManager), amount);
        poolManager.settle();
    }
}

