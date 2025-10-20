// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IPoolManager} from "@uniswap/v4-core/contracts/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/contracts/types/PoolKey.sol";
import {BalanceDelta} from "@uniswap/v4-core/contracts/types/BalanceDelta.sol";
import {Currency, CurrencyLibrary} from "@uniswap/v4-core/contracts/types/Currency.sol";
import {ILockCallback} from "@uniswap/v4-core/contracts/interfaces/callback/ILockCallback.sol";
import {IERC20} from "solmate/tokens/ERC20.sol";
import {SafeTransferLib} from "solmate/utils/SafeTransferLib.sol";

/// @notice Minimal swap router that interacts with the Uniswap v4 PoolManager and custom hook.
contract MinimalSwapRouterV4 is ILockCallback {
    using CurrencyLibrary for Currency;
    using SafeTransferLib for IERC20;

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

    constructor(IPoolManager _poolManager) {
        poolManager = _poolManager;
    }

    function swapExactInput(SwapExactInputParams calldata params) external returns (uint256 amountOut) {
        if (params.deadline < block.timestamp) revert DeadlinePassed();
        bytes memory result = poolManager.lock(abi.encode(CommandType.SWAP_EXACT_IN, params, msg.sender));
        amountOut = abi.decode(result, (uint256));
        if (amountOut < params.amountOutMin) revert TooMuchRequested();
        emit SwapExecuted(msg.sender, params.recipient, params.zeroForOne, params.amountIn, amountOut);
    }

    function swapExactOutput(SwapExactOutputParams calldata params) external returns (uint256 amountIn) {
        if (params.deadline < block.timestamp) revert DeadlinePassed();
        bytes memory result = poolManager.lock(abi.encode(CommandType.SWAP_EXACT_OUT, params, msg.sender));
        amountIn = abi.decode(result, (uint256));
        if (amountIn > params.amountInMax) revert TooMuchRequested();
        emit SwapExecuted(msg.sender, params.recipient, params.zeroForOne, amountIn, params.amountOut);
    }

    /// @inheritdoc ILockCallback
    function lockAcquired(bytes calldata data) external returns (bytes memory) {
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

        IERC20 inputToken = IERC20(inputCurrency.toAddress());
        inputToken.safeTransferFrom(params.payer == address(0) ? caller : params.payer, address(this), params.amountIn);
        inputToken.safeApprove(address(poolManager), params.amountIn);
        poolManager.settle(inputCurrency);

        IPoolManager.SwapParams memory swapParams = IPoolManager.SwapParams({
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

        IPoolManager.SwapParams memory swapParams = IPoolManager.SwapParams({
            zeroForOne: params.zeroForOne,
            amountSpecified: -int256(params.amountOut),
            sqrtPriceLimitX96: params.sqrtPriceLimitX96
        });

        BalanceDelta delta = poolManager.swap(params.key, swapParams, abi.encode(caller));

        int128 inputDelta = params.zeroForOne ? delta.amount0() : delta.amount1();
        uint256 amountIn = _toPositive(inputDelta);
        if (amountIn > params.amountInMax) revert TooMuchRequested();

        IERC20 inputToken = IERC20(inputCurrency.toAddress());
        inputToken.safeTransferFrom(params.payer == address(0) ? caller : params.payer, address(this), amountIn);
        inputToken.safeApprove(address(poolManager), amountIn);
        poolManager.settle(inputCurrency);

        poolManager.take(outputCurrency, params.recipient, params.amountOut);
        return abi.encode(amountIn);
    }

    function _toPositive(int128 value) private pure returns (uint256) {
        return uint256(uint128(value < 0 ? -value : value));
    }
}
