// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title StrategyRegistry
 * @notice PROVUS — Every AI strategy is minted as an ERC-721 NFT.
 *         Followers pay a subscription fee to receive verified signals.
 *
 * NFT tokenId == strategyId (1-indexed).
 */
contract StrategyRegistry is ERC721, Ownable {
    // ─── State ────────────────────────────────────────────────────────────────

    uint256 public nextStrategyId = 1;

    struct Strategy {
        address provider;
        string name;
        string description;
        uint256 subscriptionFee; // wei per 30-day epoch (0 = free)
        bool active;
        uint256 totalSignals;    // incremented by VerifierEngine on verified decisions
        uint256 registeredAt;
    }

    mapping(uint256 => Strategy) public strategies;
    mapping(address => uint256[]) public providerStrategies;
    // strategyId => subscriber => subscription expiry (unix timestamp)
    mapping(uint256 => mapping(address => uint256)) public subscriptions;

    address public verifierEngine;

    // ─── Events ───────────────────────────────────────────────────────────────

    event StrategyRegistered(uint256 indexed strategyId, address indexed provider, string name);
    event Subscribed(uint256 indexed strategyId, address indexed subscriber, uint256 expiry);
    event SignalCounted(uint256 indexed strategyId, uint256 totalSignals);

    // ─── Constructor ──────────────────────────────────────────────────────────

    constructor() ERC721("Provus Strategy", "PRVS-NFT") Ownable(msg.sender) {}

    // ─── Strategy Registration ────────────────────────────────────────────────

    /**
     * @notice Register an AI strategy as an NFT. Caller becomes the strategy provider.
     * @param name            Human-readable strategy name (e.g. "YZ-Delta v1")
     * @param description     Strategy description / methodology
     * @param subscriptionFee Wei per 30-day epoch. Set 0 for a free/public strategy.
     * @return strategyId     The NFT token ID assigned to this strategy.
     */
    function registerStrategy(
        string calldata name,
        string calldata description,
        uint256 subscriptionFee
    ) external returns (uint256 strategyId) {
        strategyId = nextStrategyId++;

        strategies[strategyId] = Strategy({
            provider: msg.sender,
            name: name,
            description: description,
            subscriptionFee: subscriptionFee,
            active: true,
            totalSignals: 0,
            registeredAt: block.timestamp
        });

        providerStrategies[msg.sender].push(strategyId);
        _mint(msg.sender, strategyId);

        emit StrategyRegistered(strategyId, msg.sender, name);
    }

    // ─── Subscriptions ────────────────────────────────────────────────────────

    /**
     * @notice Subscribe to a strategy for 30 days. Forwards fee to provider.
     */
    function subscribe(uint256 strategyId) external payable {
        Strategy storage s = strategies[strategyId];
        require(s.active, "Strategy not active");
        require(msg.value >= s.subscriptionFee, "Insufficient fee");

        subscriptions[strategyId][msg.sender] = block.timestamp + 30 days;

        // Forward fee to strategy provider
        if (msg.value > 0) {
            (bool ok, ) = s.provider.call{ value: msg.value }("");
            require(ok, "Fee transfer failed");
        }

        emit Subscribed(strategyId, msg.sender, subscriptions[strategyId][msg.sender]);
    }

    /**
     * @notice Returns true if subscriber has an active subscription.
     */
    function isSubscribed(uint256 strategyId, address subscriber) external view returns (bool) {
        return subscriptions[strategyId][subscriber] > block.timestamp;
    }

    // ─── Signal Counting (called by VerifierEngine) ───────────────────────────

    /**
     * @notice Called by VerifierEngine after each verified decision.
     *         Only the registered VerifierEngine contract can call this.
     */
    function incrementSignalCount(uint256 strategyId) external {
        require(msg.sender == verifierEngine, "Only VerifierEngine");
        strategies[strategyId].totalSignals++;
        emit SignalCounted(strategyId, strategies[strategyId].totalSignals);
    }

    // ─── Admin ────────────────────────────────────────────────────────────────

    function setVerifierEngine(address _ve) external onlyOwner {
        verifierEngine = _ve;
    }

    function deactivateStrategy(uint256 strategyId) external {
        require(
            strategies[strategyId].provider == msg.sender || msg.sender == owner(),
            "Not authorized"
        );
        strategies[strategyId].active = false;
    }

    function getProviderStrategies(address provider) external view returns (uint256[] memory) {
        return providerStrategies[provider];
    }
}
