// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title StrategyVault
 * @notice PROVUS — Execution wallet for each AI strategy.
 *
 * Holds native OG tokens as trading capital.
 * Records every trade execution on-chain (even simulated swaps).
 * When a real DEX is available on 0G Chain, the executeTrade() function
 * forwards the swap call to the router. Otherwise it emits TradeExecuted
 * as the on-chain proof of agent execution.
 */
contract StrategyVault {
    // ─── Types ────────────────────────────────────────────────────────────────

    struct Trade {
        uint256 strategyId;
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
        string signal;       // "BUY" | "SELL" | "HOLD"
        uint256 taskId;      // matches VerifierEngine taskId
        uint256 timestamp;
        bool swapExecuted;   // true if dexRouter call was made
    }

    // ─── State ────────────────────────────────────────────────────────────────

    address public owner;
    address public verifierEngine;

    mapping(uint256 => Trade[]) public trades;              // strategyId → trade history
    mapping(uint256 => uint256) public strategyBalances;    // strategyId → OG balance

    uint256 public totalTrades;

    // ─── Events ───────────────────────────────────────────────────────────────

    event TradeExecuted(
        uint256 indexed strategyId,
        uint256 indexed taskId,
        string signal,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        bool swapExecuted,
        uint256 timestamp
    );

    event FundsDeposited(uint256 indexed strategyId, address indexed depositor, uint256 amount);
    event FundsWithdrawn(uint256 indexed strategyId, uint256 amount);

    // ─── Modifiers ────────────────────────────────────────────────────────────

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier onlyAuthorized() {
        require(msg.sender == verifierEngine || msg.sender == owner, "Not authorized");
        _;
    }

    // ─── Constructor ──────────────────────────────────────────────────────────

    constructor() {
        owner = msg.sender;
    }

    // ─── Funding ──────────────────────────────────────────────────────────────

    /**
     * @notice Deposit native OG tokens as trading capital for a strategy.
     */
    function deposit(uint256 strategyId) external payable {
        require(msg.value > 0, "Zero deposit");
        strategyBalances[strategyId] += msg.value;
        emit FundsDeposited(strategyId, msg.sender, msg.value);
    }

    // ─── Trade Execution ─────────────────────────────────────────────────────

    /**
     * @notice Execute a trade for a strategy. Called by agent after VerifierEngine.attest().
     *
     * @param strategyId  Strategy NFT token ID
     * @param taskId      Must match the taskId passed to VerifierEngine.attest()
     * @param tokenIn     Address(0) for native OG, or ERC-20 address
     * @param tokenOut    Output token address
     * @param amountIn    Amount to swap
     * @param signal      "BUY" | "SELL" | "HOLD"
     * @param dexRouter   DEX router address. Pass address(0) to record-only (no real swap).
     * @param swapData    Encoded swap calldata. Empty if dexRouter is address(0).
     */
    function executeTrade(
        uint256 strategyId,
        uint256 taskId,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        string calldata signal,
        address dexRouter,
        bytes calldata swapData
    ) external onlyAuthorized {
        bool swapExecuted = false;

        // Attempt real swap if router is provided
        if (dexRouter != address(0) && swapData.length > 0 && amountIn > 0) {
            if (tokenIn == address(0)) {
                // Native token swap
                require(strategyBalances[strategyId] >= amountIn, "Insufficient vault balance");
                strategyBalances[strategyId] -= amountIn;
                (bool ok, ) = dexRouter.call{ value: amountIn }(swapData);
                require(ok, "Swap failed");
                swapExecuted = true;
            } else {
                // ERC-20 swap (agent must have pre-approved or vault holds tokens)
                (bool ok, ) = dexRouter.call(swapData);
                require(ok, "Swap failed");
                swapExecuted = true;
            }
        }

        trades[strategyId].push(Trade({
            strategyId: strategyId,
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            amountIn: amountIn,
            signal: signal,
            taskId: taskId,
            timestamp: block.timestamp,
            swapExecuted: swapExecuted
        }));

        totalTrades++;

        emit TradeExecuted(
            strategyId,
            taskId,
            signal,
            tokenIn,
            tokenOut,
            amountIn,
            swapExecuted,
            block.timestamp
        );
    }

    // ─── Views ────────────────────────────────────────────────────────────────

    function getTrades(uint256 strategyId) external view returns (Trade[] memory) {
        return trades[strategyId];
    }

    function getTradeCount(uint256 strategyId) external view returns (uint256) {
        return trades[strategyId].length;
    }

    // ─── Admin ────────────────────────────────────────────────────────────────

    function withdraw(uint256 strategyId, uint256 amount) external onlyOwner {
        require(strategyBalances[strategyId] >= amount, "Insufficient balance");
        strategyBalances[strategyId] -= amount;
        (bool ok, ) = owner.call{ value: amount }("");
        require(ok, "Transfer failed");
        emit FundsWithdrawn(strategyId, amount);
    }

    function setVerifierEngine(address _ve) external onlyOwner {
        verifierEngine = _ve;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        owner = newOwner;
    }

    receive() external payable {}
}
