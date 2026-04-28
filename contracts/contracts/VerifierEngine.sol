// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title VerifierEngine
 * @notice PROVUS — The heart of the protocol.
 *
 * Every AI trading decision goes through this contract:
 *   1. Agent calls 0G Compute → gets signal + isValid (TEE attestation)
 *   2. Agent uploads reasoning trace to 0G Storage → gets storageRoot
 *   3. Agent calls VerifierEngine.attest() → stores proof on 0G Chain
 *   4. Emits DecisionVerified event — the permanent, auditable record
 *
 * The attestationHash = keccak256(chatId + response + isValid + providerAddress)
 * The storageRoot     = 0G Storage Merkle root of the full reasoning trace JSON
 */

interface IStrategyRegistry {
    function incrementSignalCount(uint256 strategyId) external;
}

interface IReputationEngine {
    function updateScore(uint256 strategyId, int256 pnlBps) external;
    function initStrategy(uint256 strategyId) external;
}

contract VerifierEngine {
    // ─── Types ────────────────────────────────────────────────────────────────

    struct Decision {
        uint256 strategyId;
        uint256 taskId;
        bytes32 attestationHash; // keccak256 of (chatId + content + isValid + providerAddress)
        bytes32 storageRoot;     // 0G Storage Merkle root of reasoning trace
        string signal;           // "BUY" | "SELL" | "HOLD"
        uint256 confidence;      // 0–100 (confidence * 100, e.g. 82 = 0.82)
        uint256 timestamp;
        bool verified;           // true if TEE processResponse returned true
    }

    // ─── State ────────────────────────────────────────────────────────────────

    address public owner;
    IStrategyRegistry public registry;
    IReputationEngine public reputation;

    mapping(uint256 => Decision[]) public decisions;        // strategyId → decisions
    mapping(bytes32 => bool) public attestationUsed;        // replay protection
    mapping(address => bool) public authorized;             // agent wallets allowed to attest

    uint256 public totalAttestations;
    uint256 public verifiedAttestations;

    // ─── Events ───────────────────────────────────────────────────────────────

    event DecisionVerified(
        uint256 indexed strategyId,
        uint256 indexed taskId,
        bytes32 attestationHash,
        bytes32 storageRoot,
        string signal,
        uint256 confidence,
        bool verified,
        uint256 timestamp
    );

    event AuthorizedAgent(address indexed agent, bool status);

    event VolatilityRecorded(
        uint256 indexed strategyId,
        uint256 indexed taskId,
        uint256 volBps,
        string regime,
        uint256 timestamp
    );

    // ─── Modifiers ────────────────────────────────────────────────────────────

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier onlyAuthorized() {
        require(authorized[msg.sender] || msg.sender == owner, "Not authorized");
        _;
    }

    // ─── Constructor ──────────────────────────────────────────────────────────

    constructor(address _registry) {
        owner = msg.sender;
        authorized[msg.sender] = true;
        registry = IStrategyRegistry(_registry);
    }

    // ─── Lightweight heartbeat: record volatility every loop iteration ────────

    /**
     * @notice Records Yang-Zhang volatility on-chain every agent loop iteration.
     *         This is the Provus equivalent of Parry's updateVolatility() —
     *         it fires on EVERY iteration regardless of signal, ensuring continuous
     *         on-chain activity that builds verifiable proof of agent operation.
     *
     * @param strategyId  Strategy NFT token ID
     * @param taskId      Monotonically increasing agent task counter
     * @param volBps      Yang-Zhang annualized vol in basis points (e.g. 4200 = 42%)
     * @param regime      "LOW" | "MEDIUM" | "HIGH" | "EXTREME"
     */
    function recordVolatility(
        uint256 strategyId,
        uint256 taskId,
        uint256 volBps,
        string calldata regime
    ) external onlyAuthorized {
        emit VolatilityRecorded(strategyId, taskId, volBps, regime, block.timestamp);
    }

    // ─── Core: Attestation ────────────────────────────────────────────────────

    /**
     * @notice Record a verified AI trading decision on-chain.
     *
     * @param strategyId      NFT token ID of the strategy
     * @param taskId          Monotonically increasing agent task counter
     * @param attestationHash keccak256(chatId + content + isValid + providerAddress)
     * @param storageRoot     0G Storage Merkle root of the reasoning trace
     * @param signal          "BUY", "SELL", or "HOLD"
     * @param confidence      0–100 (multiply float confidence by 100 off-chain)
     * @param isValid         Result of broker.inference.responseProcessor.processResponse()
     */
    function attest(
        uint256 strategyId,
        uint256 taskId,
        bytes32 attestationHash,
        bytes32 storageRoot,
        string calldata signal,
        uint256 confidence,
        bool isValid
    ) external onlyAuthorized {
        require(!attestationUsed[attestationHash], "Attestation replay");
        require(bytes(signal).length > 0, "Signal required");
        require(confidence <= 100, "Confidence 0-100");

        attestationUsed[attestationHash] = true;

        decisions[strategyId].push(Decision({
            strategyId: strategyId,
            taskId: taskId,
            attestationHash: attestationHash,
            storageRoot: storageRoot,
            signal: signal,
            confidence: confidence,
            timestamp: block.timestamp,
            verified: isValid
        }));

        totalAttestations++;
        if (isValid) verifiedAttestations++;

        // Notify registry to increment signal count
        try registry.incrementSignalCount(strategyId) {} catch {}

        emit DecisionVerified(
            strategyId,
            taskId,
            attestationHash,
            storageRoot,
            signal,
            confidence,
            isValid,
            block.timestamp
        );
    }

    // ─── Views ────────────────────────────────────────────────────────────────

    function getDecisions(uint256 strategyId) external view returns (Decision[] memory) {
        return decisions[strategyId];
    }

    function getDecisionCount(uint256 strategyId) external view returns (uint256) {
        return decisions[strategyId].length;
    }

    function getLatestDecision(uint256 strategyId) external view returns (Decision memory) {
        Decision[] storage d = decisions[strategyId];
        require(d.length > 0, "No decisions yet");
        return d[d.length - 1];
    }

    // ─── Admin ────────────────────────────────────────────────────────────────

    function setRegistry(address _registry) external onlyOwner {
        registry = IStrategyRegistry(_registry);
    }

    function setReputation(address _reputation) external onlyOwner {
        reputation = IReputationEngine(_reputation);
    }

    function setAuthorized(address agent, bool status) external onlyOwner {
        authorized[agent] = status;
        emit AuthorizedAgent(agent, status);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        owner = newOwner;
    }
}
