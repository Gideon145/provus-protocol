// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ArchiveRegistry
 * @notice PROVUS — Permanent 0G Storage archive index.
 *
 * Every N agent iterations, the PROVUS agent batches the last N decision
 * records (signal, volatility, confidence, attestationHash, timestamp) into
 * a single JSON blob and uploads it to 0G Storage. The Storage SDK returns
 * a content-addressed Merkle root. That root is then registered here.
 *
 * Result: a tamper-proof bridge between 0G Chain (state) and 0G Storage
 * (history). Anyone can:
 *   1. Read `archives(batchId)` to get the rootHash.
 *   2. Fetch the JSON blob from 0G Storage using that rootHash.
 *   3. Reconstruct the agent's full decision history with cryptographic
 *      guarantees that nothing has been altered or backdated.
 *
 * This contract is intentionally minimal — the heavy attestation logic stays
 * in VerifierEngine. ArchiveRegistry is a pure append-only index for batched
 * forensic audit data.
 */
contract ArchiveRegistry {
    struct Batch {
        uint256 batchId;
        uint256 strategyId;
        bytes32 rootHash;       // 0G Storage Merkle root
        uint256 fromIteration;  // first iteration covered by this batch
        uint256 toIteration;    // last iteration covered by this batch
        uint256 decisionCount;  // number of decisions archived in this blob
        uint256 timestamp;      // block.timestamp at archive
        address archiver;       // agent wallet that submitted this batch
    }

    address public owner;
    mapping(address => bool) public authorized;

    Batch[] public archives;
    mapping(uint256 => uint256) public batchIndexById; // batchId -> archives[] index + 1 (0 = not set)

    uint256 public totalBatches;
    uint256 public totalDecisionsArchived;

    event BatchArchived(
        uint256 indexed batchId,
        uint256 indexed strategyId,
        bytes32 rootHash,
        uint256 fromIteration,
        uint256 toIteration,
        uint256 decisionCount,
        address archiver,
        uint256 timestamp
    );

    event AuthorizedAgent(address indexed agent, bool status);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier onlyAuthorized() {
        require(authorized[msg.sender] || msg.sender == owner, "Not authorized");
        _;
    }

    constructor() {
        owner = msg.sender;
        authorized[msg.sender] = true;
    }

    /**
     * @notice Register a batch of decisions archived to 0G Storage.
     *
     * @param batchId       Monotonically increasing agent-side batch counter.
     * @param strategyId    Strategy NFT ID this batch belongs to.
     * @param rootHash      0G Storage Merkle root returned by the Storage SDK.
     * @param fromIteration First agent iteration included in this batch.
     * @param toIteration   Last agent iteration included in this batch.
     * @param decisionCount Number of decisions archived in the JSON blob.
     */
    function archiveBatch(
        uint256 batchId,
        uint256 strategyId,
        bytes32 rootHash,
        uint256 fromIteration,
        uint256 toIteration,
        uint256 decisionCount
    ) external onlyAuthorized {
        require(rootHash != bytes32(0), "Root required");
        require(batchIndexById[batchId] == 0, "Batch exists");
        require(toIteration >= fromIteration, "Range invalid");
        require(decisionCount > 0, "Empty batch");

        archives.push(Batch({
            batchId: batchId,
            strategyId: strategyId,
            rootHash: rootHash,
            fromIteration: fromIteration,
            toIteration: toIteration,
            decisionCount: decisionCount,
            timestamp: block.timestamp,
            archiver: msg.sender
        }));

        batchIndexById[batchId] = archives.length; // store index+1
        totalBatches++;
        totalDecisionsArchived += decisionCount;

        emit BatchArchived(
            batchId,
            strategyId,
            rootHash,
            fromIteration,
            toIteration,
            decisionCount,
            msg.sender,
            block.timestamp
        );
    }

    // ─── Views ────────────────────────────────────────────────────────────────

    function getArchiveCount() external view returns (uint256) {
        return archives.length;
    }

    function getArchive(uint256 index) external view returns (Batch memory) {
        require(index < archives.length, "Index OOB");
        return archives[index];
    }

    function getArchiveById(uint256 batchId) external view returns (Batch memory) {
        uint256 idxPlus = batchIndexById[batchId];
        require(idxPlus != 0, "Not found");
        return archives[idxPlus - 1];
    }

    function getLatestArchive() external view returns (Batch memory) {
        require(archives.length > 0, "No archives");
        return archives[archives.length - 1];
    }

    /**
     * @notice Returns the last `n` archives (most recent first).
     */
    function getRecentArchives(uint256 n) external view returns (Batch[] memory) {
        uint256 len = archives.length;
        if (n > len) n = len;
        Batch[] memory out = new Batch[](n);
        for (uint256 i = 0; i < n; i++) {
            out[i] = archives[len - 1 - i];
        }
        return out;
    }

    // ─── Admin ────────────────────────────────────────────────────────────────

    function setAuthorized(address agent, bool status) external onlyOwner {
        authorized[agent] = status;
        emit AuthorizedAgent(agent, status);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Zero address");
        owner = newOwner;
    }
}
