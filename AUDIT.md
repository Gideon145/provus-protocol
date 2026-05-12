# PROVUS Protocol — Smart Contract Audit

**Audited by:** ChainGPT AI Smart Contract Auditor  
**Date:** May 2026  
**Auditor:** [app.chaingpt.org/smart-contract-auditor](https://app.chaingpt.org/smart-contract-auditor)  
**Contracts audited:** 5  
**Compiler:** Solidity ^0.8.20  

---

## Severity Summary

| Severity | Count |
|----------|-------|
| 🔴 Critical | 0 |
| 🟠 High | 0 |
| 🟡 Medium | 2 |
| 🔵 Low | 6 |
| ⚪ Informational | 1 |

**No critical or high severity findings.**

---

## Contracts Audited

| Contract | Role |
|----------|------|
| `VerifierEngine.sol` | Core attestation — records every AI decision on-chain |
| `StrategyRegistry.sol` | ERC-721 NFT registry for AI strategies |
| `ReputationEngine.sol` | ELO-based reputation scoring |
| `StrategyVault.sol` | Fund custody and trade execution |
| `ArchiveRegistry.sol` | 0G Storage batch archive index |

---

## Full Audit Report

### General Observations

1. **Versioning**: All contracts use Solidity `^0.8.20`, which includes several security improvements over previous versions.
2. **Access Control**: The use of `onlyOwner` and `onlyAuthorized` modifiers is appropriate for restricting access to sensitive functions.
3. **Error Handling**: The contracts use `require` statements effectively for input validation and error handling.

---

### Findings

#### M-01 — Reentrancy Risk
**Severity:** Medium  
**Contracts:** `StrategyVault.executeTrade`, `StrategyRegistry.subscribe`, `StrategyVault.withdraw`  
**Description:** Functions that involve external calls may be vulnerable to reentrancy attacks.  
**Recommendation:** Implement the Checks-Effects-Interactions pattern. Update state variables before making external calls. Consider using OpenZeppelin's `ReentrancyGuard`.  
**Status:** Acknowledged — contracts are currently owner/agent-only; no public-facing value-transfer flows are exposed to untrusted callers at this time.

---

#### M-02 — DoS Risk on Registry Call in `attest()`
**Severity:** Medium  
**Contract:** `VerifierEngine.attest`  
**Description:** The `try-catch` wrapping `registry.incrementSignalCount()` may not handle all failure scenarios gracefully.  
**Recommendation:** Ensure critical logic is not dependent on external contract calls, or handle failures such that they do not affect overall contract functionality.  
**Status:** Acknowledged — failure is already caught and emitted as `RegistryCallFailed` event; attestation continues regardless.

---

#### L-01 — Gas Limit on Array Iteration
**Severity:** Low  
**Contract:** `ReputationEngine.getEloScores`  
**Description:** Functions iterating over arrays can hit gas limits if arrays grow large.  
**Recommendation:** Limit elements processed per call or implement pagination.  
**Status:** Acknowledged — `getEloScores` is a view function called off-chain only; no on-chain loop dependency.

---

#### L-02 — Access Control on External Calls
**Severity:** Low  
**Contract:** `StrategyRegistry.incrementSignalCount`  
**Description:** If `verifierEngine` is set to a malicious contract, it could manipulate signal counts.  
**Recommendation:** Implement role-based access control or multi-sig for critical admin functions.  
**Status:** Acknowledged — `setVerifierEngine` is `onlyOwner`; owner key is secured.

---

#### L-03 — Missing Zero Address Checks
**Severity:** Low  
**Contracts:** `VerifierEngine.setRegistry`, `VerifierEngine.setReputation`, `StrategyVault.setVerifierEngine`, `ReputationEngine.setVerifierEngine`  
**Description:** Setter functions do not revert on zero address input.  
**Recommendation:** Add `require(addr != address(0))` guards.  
**Status:** Acknowledged — `ArchiveRegistry.transferOwnership` already has this check; will add to remaining setters in next contract iteration.

---

#### L-04 — Missing Events on State-Changing Functions
**Severity:** Low  
**Contracts:** `VerifierEngine.setRegistry`, `VerifierEngine.setReputation`  
**Description:** Not all state-changing functions emit events.  
**Recommendation:** Add events for all admin setter functions for transparency.  
**Status:** Acknowledged.

---

#### L-05 — Integer Overflow/Underflow
**Severity:** Low  
**Description:** While Solidity 0.8.x has built-in overflow/underflow protection, external inputs should still be validated.  
**Recommendation:** Validate external inputs are within expected ranges.  
**Status:** Resolved — `confidence <= 100` check in `attest()`, `decisionCount > 0` and `toIteration >= fromIteration` checks in `archiveBatch()`.

---

#### L-06 — Unauthorized Archive Access
**Severity:** Low  
**Contract:** `ArchiveRegistry.archiveBatch`  
**Description:** Unauthorized agents could potentially archive data.  
**Recommendation:** Ensure only authorized agents can call `archiveBatch`.  
**Status:** Resolved — `onlyAuthorized` modifier enforces this; `authorized` mapping is owner-controlled.

---

#### I-01 — Constructor Pattern (Informational)
**Severity:** Informational  
**Contract:** `StrategyRegistry`  
**Description:** Constructor uses `Ownable(msg.sender)` — the `Ownable` contract in OpenZeppelin v5 requires this explicit parameter; this is correct for OZ v5.  
**Status:** Not applicable — OZ v5 requires explicit `msg.sender` in `Ownable` constructor.

---

## Conclusion

The contracts are well-structured with appropriate access control and error handling. **Zero critical or high severity findings.** Medium findings are architectural patterns that do not affect the production agent flow (agent wallet is the sole authorized caller). Low findings are documented above with resolutions or acknowledgements.

Contracts are deployed and live on **0G Chain Mainnet (Chain ID 16661)**. See [ENGINEERING_DEBUG_LOG.md](ENGINEERING_DEBUG_LOG.md) for deployment history.
