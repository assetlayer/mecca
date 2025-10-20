// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    function decimals() external view returns (uint8);
    function symbol() external view returns (string memory);
    function name() external view returns (string memory);
}

/**
 * @title SimpleV3Pool
 * @dev A simplified Uniswap V3-style pool for AssetLayer network
 * This provides basic pool functionality without the complexity of V4
 */
contract SimpleV3Pool {
    IERC20 public token0;
    IERC20 public token1;
    address public owner;
    
    uint256 public reserve0;
    uint256 public reserve1;
    
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    
    event Mint(address indexed sender, uint256 amount0, uint256 amount1);
    event Burn(address indexed sender, uint256 amount0, uint256 amount1, address indexed to);
    event Swap(
        address indexed sender,
        uint256 amount0In,
        uint256 amount1In,
        uint256 amount0Out,
        uint256 amount1Out,
        address indexed to
    );
    
    constructor(address _token0, address _token1) {
        token0 = IERC20(_token0);
        token1 = IERC20(_token1);
        owner = msg.sender;
    }
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Not the owner");
        _;
    }
    
    function mint(uint256 amount0, uint256 amount1) external {
        require(amount0 > 0 && amount1 > 0, "Invalid amounts");
        
        // Transfer tokens from sender
        token0.transferFrom(msg.sender, address(this), amount0);
        token1.transferFrom(msg.sender, address(this), amount1);
        
        // Calculate liquidity (simplified)
        uint256 liquidity = amount0 + amount1;
        
        // Update reserves
        reserve0 += amount0;
        reserve1 += amount1;
        
        // Mint LP tokens
        totalSupply += liquidity;
        balanceOf[msg.sender] += liquidity;
        
        emit Mint(msg.sender, amount0, amount1);
    }
    
    function burn(uint256 liquidity, address to) external {
        require(liquidity > 0, "Invalid liquidity");
        require(balanceOf[msg.sender] >= liquidity, "Insufficient balance");
        
        // Calculate amounts to return
        uint256 amount0 = (reserve0 * liquidity) / totalSupply;
        uint256 amount1 = (reserve1 * liquidity) / totalSupply;
        
        // Update balances
        balanceOf[msg.sender] -= liquidity;
        totalSupply -= liquidity;
        
        // Update reserves
        reserve0 -= amount0;
        reserve1 -= amount1;
        
        // Transfer tokens
        token0.transfer(to, amount0);
        token1.transfer(to, amount1);
        
        emit Burn(msg.sender, amount0, amount1, to);
    }
    
    function swap(
        uint256 amount0Out,
        uint256 amount1Out,
        address to
    ) external {
        require(amount0Out > 0 || amount1Out > 0, "Invalid amounts");
        require(amount0Out < reserve0 && amount1Out < reserve1, "Insufficient liquidity");
        
        uint256 amount0In = 0;
        uint256 amount1In = 0;
        
        if (amount0Out > 0) {
            // Swapping Token1 for Token0
            amount1In = (amount0Out * reserve1) / reserve0;
            require(amount1In > 0, "Invalid input amount");
            token1.transferFrom(msg.sender, address(this), amount1In);
            token0.transfer(to, amount0Out);
            reserve0 -= amount0Out;
            reserve1 += amount1In;
        }
        
        if (amount1Out > 0) {
            // Swapping Token0 for Token1
            amount0In = (amount1Out * reserve0) / reserve1;
            require(amount0In > 0, "Invalid input amount");
            token0.transferFrom(msg.sender, address(this), amount0In);
            token1.transfer(to, amount1Out);
            reserve0 += amount0In;
            reserve1 -= amount1Out;
        }
        
        emit Swap(msg.sender, amount0In, amount1In, amount0Out, amount1Out, to);
    }
    
    function getReserves() external view returns (uint256, uint256) {
        return (reserve0, reserve1);
    }
}
