// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ReputationEngine
 * @notice PROVUS — ELO-based reputation scoring on verified P&L.
 *
 * Only verified decisions (isValid=true from VerifierEngine) update scores.
 * Scoring rules:
 *   - New strategies (< 30 decisions): K = 64  (high volatility)
 *   - Veteran strategies (≥ 30):       K = 32  (stable)
 *   - All strategies start at ELO 1500
 *   - Win  (pnlBps > 0): +K/2 to ELO
 *   - Loss (pnlBps < 0): −K/2 from ELO (floor 0)
 */
contract ReputationEngine {
    // ─── Types ────────────────────────────────────────────────────────────────

    struct StrategyScore {
        uint256 eloScore;         // starts at 1500
        uint256 wins;
        uint256 losses;
        int256 realizedPnlBps;    // cumulative realized P&L in basis points
        uint256 lastUpdated;
        bool initialized;
    }

    // ─── State ────────────────────────────────────────────────────────────────

    address public owner;
    address public verifierEngine;

    mapping(uint256 => StrategyScore) public scores;

    // ─── Events ───────────────────────────────────────────────────────────────

    event ScoreUpdated(
        uint256 indexed strategyId,
        uint256 newElo,
        int256 pnlBps,
        bool win,
        uint256 wins,
        uint256 losses
    );

    event StrategyInitialized(uint256 indexed strategyId);

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

    // ─── Initialization ───────────────────────────────────────────────────────

    function initStrategy(uint256 strategyId) external onlyAuthorized {
        if (!scores[strategyId].initialized) {
            scores[strategyId] = StrategyScore({
                eloScore: 1500,
                wins: 0,
                losses: 0,
                realizedPnlBps: 0,
                lastUpdated: block.timestamp,
                initialized: true
            });
            emit StrategyInitialized(strategyId);
        }
    }

    // ─── Score Update ─────────────────────────────────────────────────────────

    /**
     * @notice Update a strategy's ELO score based on realized P&L.
     * @param strategyId Strategy to update
     * @param pnlBps     Realized P&L in basis points (positive = win, negative = loss)
     *                   e.g. +150 = +1.5% gain, -80 = -0.8% loss
     */
    function updateScore(uint256 strategyId, int256 pnlBps) external onlyAuthorized {
        StrategyScore storage s = scores[strategyId];

        // Auto-initialize if not already done
        if (!s.initialized) {
            s.eloScore = 1500;
            s.initialized = true;
        }

        s.realizedPnlBps += pnlBps;
        s.lastUpdated = block.timestamp;

        bool win = pnlBps > 0;
        uint256 totalDecisions = s.wins + s.losses;
        uint256 K = totalDecisions < 30 ? 64 : 32;

        if (win) {
            s.wins++;
            s.eloScore += K / 2;
        } else {
            s.losses++;
            uint256 decrement = K / 2;
            s.eloScore = s.eloScore > decrement ? s.eloScore - decrement : 0;
        }

        emit ScoreUpdated(strategyId, s.eloScore, pnlBps, win, s.wins, s.losses);
    }

    // ─── Views ────────────────────────────────────────────────────────────────

    function getScore(uint256 strategyId) external view returns (StrategyScore memory) {
        return scores[strategyId];
    }

    /**
     * @notice Returns ELO scores for a list of strategy IDs (for ranking).
     *         Sort descending off-chain.
     */
    function getEloScores(uint256[] calldata strategyIds)
        external
        view
        returns (uint256[] memory elos)
    {
        elos = new uint256[](strategyIds.length);
        for (uint256 i = 0; i < strategyIds.length; i++) {
            elos[i] = scores[strategyIds[i]].eloScore;
        }
    }

    // ─── Admin ────────────────────────────────────────────────────────────────

    function setVerifierEngine(address _ve) external onlyOwner {
        verifierEngine = _ve;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        owner = newOwner;
    }
}
