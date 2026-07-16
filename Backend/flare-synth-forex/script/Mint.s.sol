// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {IERC20}           from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {CollateralVault}  from "../src/core/CollateralVault.sol";
import {SyntheticAsset}   from "../src/core/SyntheticAsset.sol";
import {SynthController}  from "../src/core/SynthController.sol";

/// @title Mint
/// @notice Deposits collateral into CollateralVault and mints fxEUR,
///         for manual end-to-end testing on Coston2.
///
/// Required environment variables:
///   PRIVATE_KEY        – broadcaster private key
///   CONTROLLER_ADDR    – deployed SynthController address
///   VAULT_ADDR         – deployed CollateralVault address
///   SYNTH_ADDR         – deployed SyntheticAsset address
///   COLLATERAL_TOKEN   – ERC-20 collateral token address
///   COLLATERAL_AMOUNT  – amount of collateral to deposit (in wei)
///   MINT_AMOUNT        – amount of fxEUR to mint (in wei)
///
/// Example (deposit 200 WNAT, mint 100 fxEUR):
///   COLLATERAL_AMOUNT=200000000000000000000
///   MINT_AMOUNT=100000000000000000000
///
/// Run:
///   forge script script/Mint.s.sol     \
///     --rpc-url $COSTON2_RPC_URL       \
///     --private-key $PRIVATE_KEY       \
///     --broadcast                      \
///     --chain-id 114                   \
///     -vvvv
contract Mint is Script {
    function run() external {
        // ── read env ──────────────────────────────────────────────────────────
        uint256 deployerKey    = vm.envUint("PRIVATE_KEY");
        address deployer       = vm.addr(deployerKey);

        address controllerAddr = vm.envAddress("CONTROLLER_ADDR");
        address vaultAddr      = vm.envAddress("VAULT_ADDR");
        address synthAddr      = vm.envAddress("SYNTH_ADDR");
        address collateralToken = vm.envAddress("COLLATERAL_TOKEN");
        uint256 collateralAmt  = vm.envUint("COLLATERAL_AMOUNT");
        uint256 mintAmt        = vm.envUint("MINT_AMOUNT");

        SynthController controller = SynthController(payable(controllerAddr));
        CollateralVault  vault     = CollateralVault(vaultAddr);
        SyntheticAsset   synth     = SyntheticAsset(synthAddr);
        IERC20           collat    = IERC20(collateralToken);

        // ── pre-flight checks ─────────────────────────────────────────────────
        uint256 tokenBalance = collat.balanceOf(deployer);
        require(tokenBalance >= collateralAmt,
            string.concat(
                "Mint: insufficient collateral balance. Have: ",
                vm.toString(tokenBalance),
                " Need: ",
                vm.toString(collateralAmt)
            )
        );

        console2.log("=== Mint Script ===");
        console2.log("Caller              :", deployer);
        console2.log("Controller          :", controllerAddr);
        console2.log("Vault               :", vaultAddr);
        console2.log("Collateral token    :", collateralToken);
        console2.log("Collateral amount   :", collateralAmt);
        console2.log("fxEUR to mint       :", mintAmt);
        console2.log("Collateral balance  :", tokenBalance);
        console2.log("");

        // ── state before ──────────────────────────────────────────────────────
        uint256 debtBefore    = controller.debtPositions(deployer);
        uint256 synthBefore   = synth.balanceOf(deployer);
        uint256 collatBefore  = vault.getCollateralBalance(deployer, collateralToken);
        console2.log("--- Before ---");
        console2.log("Debt position (fxEUR)     :", debtBefore);
        console2.log("fxEUR wallet balance      :", synthBefore);
        console2.log("Vault collateral balance  :", collatBefore);
        console2.log("");

        vm.startBroadcast(deployerKey);

        // ── step 1: approve vault to pull collateral ───────────────────────────
        collat.approve(vaultAddr, collateralAmt);
        console2.log("Step 1: Approved CollateralVault to spend", collateralAmt, "tokens");

        // ── step 2: deposit collateral ─────────────────────────────────────────
        vault.deposit(collateralToken, collateralAmt);
        console2.log("Step 2: Deposited", collateralAmt, "into CollateralVault");

        // ── step 3: mint fxEUR ────────────────────────────────────────────────
        // msg.value = 0 because MockPriceOracle ignores the fee;
        // on live Coston2, FTSOv2.getFeedById may require a small fee.
        // If it does, pass a non-zero value here and top up the script caller.
        controller.mint{value: 0}(mintAmt);
        console2.log("Step 3: Minted", mintAmt, "fxEUR");

        vm.stopBroadcast();

        // ── state after ───────────────────────────────────────────────────────
        uint256 debtAfter   = controller.debtPositions(deployer);
        uint256 synthAfter  = synth.balanceOf(deployer);
        uint256 collatAfter = vault.getCollateralBalance(deployer, collateralToken);

        console2.log("--- After ---");
        console2.log("Debt position (fxEUR)     :", debtAfter);
        console2.log("fxEUR wallet balance      :", synthAfter);
        console2.log("Vault collateral balance  :", collatAfter);
        console2.log("");

        // ── sanity assertions ─────────────────────────────────────────────────
        require(debtAfter   == debtBefore  + mintAmt,      "Mint: debt mismatch");
        require(synthAfter  == synthBefore + mintAmt,      "Mint: synth balance mismatch");
        require(collatAfter == collatBefore + collateralAmt, "Mint: collateral balance mismatch");

        console2.log("All post-mint assertions passed.");
        console2.log("=== Done ===");
    }
}
