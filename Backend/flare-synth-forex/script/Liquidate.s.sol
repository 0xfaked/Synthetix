// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {IERC20}           from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {CollateralVault}  from "../src/core/CollateralVault.sol";
import {SyntheticAsset}   from "../src/core/SyntheticAsset.sol";
import {SynthController}  from "../src/core/SynthController.sol";

/// @title Liquidate
/// @notice Reads a target user's collateral ratio. If the position is
///         undercollateralised, computes the maximum safe repayment and
///         executes liquidation. Skips silently if the position is healthy.
///
/// Required environment variables:
///   PRIVATE_KEY        – liquidator private key (must hold fxEUR to repay)
///   CONTROLLER_ADDR    – deployed SynthController address
///   VAULT_ADDR         – deployed CollateralVault address
///   SYNTH_ADDR         – deployed SyntheticAsset address
///   TARGET_USER        – address of the position to check/liquidate
///   DEBT_TO_REPAY      – fxEUR amount to repay (in wei); use 0 to auto-compute max
///
/// Run:
///   forge script script/Liquidate.s.sol  \
///     --rpc-url $COSTON2_RPC_URL         \
///     --private-key $PRIVATE_KEY         \
///     --broadcast                        \
///     --chain-id 114                     \
///     -vvvv
contract Liquidate is Script {
    uint256 internal constant BASIS_POINTS  = 10_000;
    uint256 internal constant SCALE         = 1e6;   // oracle 6-decimal default

    function run() external {
        // ── read env ──────────────────────────────────────────────────────────
        uint256 liquidatorKey  = vm.envUint("PRIVATE_KEY");
        address liquidator     = vm.addr(liquidatorKey);

        address controllerAddr = vm.envAddress("CONTROLLER_ADDR");
        address vaultAddr      = vm.envAddress("VAULT_ADDR");
        address synthAddr      = vm.envAddress("SYNTH_ADDR");
        address targetUser     = vm.envAddress("TARGET_USER");
        uint256 debtToRepay    = vm.envOr("DEBT_TO_REPAY", uint256(0));

        SynthController controller = SynthController(payable(controllerAddr));
        CollateralVault  vault     = CollateralVault(vaultAddr);
        SyntheticAsset   synth     = SyntheticAsset(synthAddr);

        console2.log("=== Liquidate Script ===");
        console2.log("Liquidator      :", liquidator);
        console2.log("Target user     :", targetUser);
        console2.log("Controller      :", controllerAddr);
        console2.log("");

        // ── read position state ───────────────────────────────────────────────
        uint256 currentDebt = controller.debtPositions(targetUser);
        console2.log("--- Target Position ---");
        console2.log("fxEUR debt              :", currentDebt);

        if (currentDebt == 0) {
            console2.log("No debt — nothing to liquidate. Exiting.");
            return;
        }

        // Read CR (this calls oracle, so pays fee = 0 on testnet)
        uint256 crBps = controller.getCollateralRatio{value: 0}(targetUser);
        uint256 minCr = controller.minimumCollateralRatioBps();

        console2.log("Collateral ratio (bps)  :", crBps);
        console2.log("Minimum CR (bps)        :", minCr);

        // Collateral value in USD18
        address[] memory tokens = vault.getSupportedTokens();
        uint256 totalCollatUsd18;
        for (uint256 i = 0; i < tokens.length; i++) {
            uint256 bal = vault.getCollateralBalance(targetUser, tokens[i]);
            totalCollatUsd18 += vault.normalizeCollateralAmount(tokens[i], bal);
            console2.log("  Token:", tokens[i], "balance:", bal);
        }
        console2.log("Total collateral USD18  :", totalCollatUsd18);
        console2.log("");

        // ── health check ──────────────────────────────────────────────────────
        if (crBps >= minCr) {
            console2.log("[HEALTHY] Collateral ratio", crBps, ">= min", minCr);
            console2.log("Position is healthy — liquidation not triggered.");
            console2.log("=== Done (no action) ===");
            return;
        }

        console2.log("[UNDERCOLLATERALISED] Ratio", crBps, "< min", minCr);
        console2.log("Proceeding to liquidate...");
        console2.log("");

        // ── compute max repayable ──────────────────────────────────────────────
        // maxRepayable = collateralUsd18 * BASIS * scale / ((BASIS + liqBonus) * price)
        // We don't have the price directly here, but we can derive it:
        //   debtValueUsd18 = currentDebt * price / scale
        //   price          = debtValueUsd18 * scale / currentDebt
        // Simplification: derive maxRepayable from the CR formula inverse.
        // crBps = collateralUsd18 * BASIS / debtValueUsd18
        // → debtValueUsd18 = collateralUsd18 * BASIS / crBps
        // maxRepayable (fxEUR) = collateralUsd18 * BASIS / ((BASIS + liqBonus) * price/scale)
        //   Since debtValueUsd18/currentDebt = price/scale:
        //   price/scale = (collateralUsd18 * BASIS / crBps) / currentDebt
        // maxRepayable = collateralUsd18 * BASIS * currentDebt * crBps
        //              / ((BASIS + liqBonus) * collateralUsd18 * BASIS)
        //              = currentDebt * crBps / (BASIS + liqBonus)
        uint256 liqBonus     = controller.liquidationBonusBps();
        uint256 maxRepayable = (currentDebt * crBps) / (BASIS_POINTS + liqBonus);

        // Cap at current debt
        if (maxRepayable > currentDebt) maxRepayable = currentDebt;

        console2.log("Max repayable fxEUR     :", maxRepayable);

        // ── determine repayment amount ────────────────────────────────────────
        uint256 repayAmt;
        if (debtToRepay == 0) {
            // Auto: repay the maximum safe amount
            repayAmt = maxRepayable;
            console2.log("DEBT_TO_REPAY=0 → auto-repay MAX:", repayAmt);
        } else {
            require(
                debtToRepay <= maxRepayable,
                string.concat(
                    "Liquidate: DEBT_TO_REPAY exceeds maxRepayable. Max: ",
                    vm.toString(maxRepayable)
                )
            );
            repayAmt = debtToRepay;
            console2.log("Using specified DEBT_TO_REPAY  :", repayAmt);
        }

        // ── check liquidator has enough fxEUR ────────────────────────────────
        uint256 liqSynthBal = synth.balanceOf(liquidator);
        require(
            liqSynthBal >= repayAmt,
            string.concat(
                "Liquidate: insufficient fxEUR. Have: ",
                vm.toString(liqSynthBal),
                " Need: ",
                vm.toString(repayAmt)
            )
        );
        console2.log("Liquidator fxEUR balance:", liqSynthBal);
        console2.log("");

        // ── state before ──────────────────────────────────────────────────────
        uint256 liqCollatBefore = 0;
        for (uint256 i = 0; i < tokens.length; i++) {
            liqCollatBefore += vault.getCollateralBalance(liquidator, tokens[i]);
        }

        vm.startBroadcast(liquidatorKey);

        // Approve controller to pull fxEUR from liquidator
        IERC20(address(synth)).approve(controllerAddr, repayAmt);
        console2.log("Approved controller to spend", repayAmt, "fxEUR");

        // Execute liquidation
        controller.liquidate{value: 0}(targetUser, repayAmt);
        console2.log("Liquidation executed.");

        vm.stopBroadcast();

        // ── state after ───────────────────────────────────────────────────────
        uint256 debtAfter  = controller.debtPositions(targetUser);
        uint256 crAfter    = (debtAfter == 0)
            ? type(uint256).max
            : controller.getCollateralRatio{value: 0}(targetUser);

        console2.log("");
        console2.log("--- After Liquidation ---");
        console2.log("Target debt remaining (fxEUR):", debtAfter);
        console2.log("Target CR after (bps)        :", crAfter == type(uint256).max ? 0 : crAfter);
        console2.log("fxEUR burned                 :", repayAmt);

        // Calculate collateral received by liquidator
        uint256 liqCollatAfter = 0;
        for (uint256 i = 0; i < tokens.length; i++) {
            uint256 received = vault.getCollateralBalance(liquidator, tokens[i]);
            console2.log("  Collateral received (", tokens[i], "):", received);
            liqCollatAfter += received;
        }
        console2.log("Total collateral gained USD18 :", liqCollatAfter - liqCollatBefore);

        require(debtAfter == currentDebt - repayAmt, "Liquidate: debt not reduced correctly");
        console2.log("");
        console2.log("Liquidation assertions passed.");
        console2.log("=== Done ===");
    }
}
