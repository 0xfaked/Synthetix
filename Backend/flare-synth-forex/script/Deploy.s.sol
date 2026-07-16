// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {PriceOracleAdapter} from "../src/oracle/PriceOracleAdapter.sol";
import {CollateralVault}    from "../src/core/CollateralVault.sol";
import {SyntheticAsset}     from "../src/core/SyntheticAsset.sol";
import {SynthController}    from "../src/core/SynthController.sol";

/// @title Deploy
/// @notice Deploys the full flare-synth-forex system in dependency order,
///         wires up permissions, and logs all addresses.
///
/// Required environment variables (in .env):
///   COSTON2_RPC_URL   – Coston2 RPC endpoint
///   PRIVATE_KEY       – deployer private key (0x-prefixed)
///
/// Optional tuning (defaults embedded below):
///   COLLATERAL_TOKEN  – address of the ERC-20 to accept as collateral
///                       (defaults to Coston2 WNAT = 0xC67DCE33D7A8efA5FfEB961899C73fe573914425)
///   MIN_CR_BPS        – minimum collateral ratio in bps (default 15000 = 150%)
///   LIQ_BONUS_BPS     – liquidation bonus in bps       (default 1000  =  10%)
///   STALENESS_SECS    – oracle staleness cap in seconds (default 90)
///   MAX_PRICE_AGE     – controller-level staleness cap  (default 120)
///
/// Run:
///   forge script script/Deploy.s.sol \
///     --rpc-url $COSTON2_RPC_URL     \
///     --private-key $PRIVATE_KEY     \
///     --broadcast                    \
///     --chain-id 114                 \
///     -vvvv
contract Deploy is Script {
    // ─── Coston2 constants ────────────────────────────────────────────────────
    /// @dev WNAT on Coston2 — used as default collateral token.
    address internal constant WNAT_COSTON2 = 0xC67DCE33D7A8efA5FfEB961899C73fe573914425;

    // ─── default parameters ───────────────────────────────────────────────────
    uint256 internal constant DEFAULT_MIN_CR_BPS     = 15_000; // 150%
    uint256 internal constant DEFAULT_LIQ_BONUS_BPS  =  1_000; // 10%
    uint256 internal constant DEFAULT_STALENESS_SECS =     90; // 90-second staleness (2 FTSO epochs)
    uint256 internal constant DEFAULT_MAX_PRICE_AGE  =    120; // controller staleness cap

    function run() external {
        // ── read env ──────────────────────────────────────────────────────────
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer    = vm.addr(deployerKey);

        address collateralToken = vm.envOr("COLLATERAL_TOKEN", WNAT_COSTON2);
        uint256 minCrBps        = vm.envOr("MIN_CR_BPS",       DEFAULT_MIN_CR_BPS);
        uint256 liqBonusBps     = vm.envOr("LIQ_BONUS_BPS",    DEFAULT_LIQ_BONUS_BPS);
        uint256 stalenessSecs   = vm.envOr("STALENESS_SECS",   DEFAULT_STALENESS_SECS);
        uint256 maxPriceAge     = vm.envOr("MAX_PRICE_AGE",    DEFAULT_MAX_PRICE_AGE);

        console2.log("=== Deployment parameters ===");
        console2.log("Deployer         :", deployer);
        console2.log("Collateral token :", collateralToken);
        console2.log("Min CR (bps)     :", minCrBps);
        console2.log("Liq bonus (bps)  :", liqBonusBps);
        console2.log("Staleness (s)    :", stalenessSecs);
        console2.log("Max price age (s):", maxPriceAge);
        console2.log("");

        vm.startBroadcast(deployerKey);

        // ── 1. PriceOracleAdapter ─────────────────────────────────────────────
        // Reads live EUR/USD from Coston2 FTSOv2 ContractRegistry.
        PriceOracleAdapter oracle = new PriceOracleAdapter(stalenessSecs);
        console2.log("1. PriceOracleAdapter deployed :", address(oracle));

        // ── 2. CollateralVault ────────────────────────────────────────────────
        // Accepts collateralToken deposits. Controller is set in step 5.
        address[] memory supportedTokens = new address[](1);
        supportedTokens[0] = collateralToken;
        CollateralVault vault = new CollateralVault(supportedTokens);
        console2.log("2. CollateralVault deployed    :", address(vault));

        // ── 3. SyntheticAsset (fxEUR) ─────────────────────────────────────────
        // admin = deployer. MINTER_ROLE is granted to SynthController in step 5.
        SyntheticAsset synth = new SyntheticAsset(deployer);
        console2.log("3. SyntheticAsset deployed     :", address(synth));

        // ── 4. SynthController ────────────────────────────────────────────────
        SynthController controller = new SynthController(
            address(vault),
            address(synth),
            address(oracle),
            minCrBps,
            liqBonusBps,
            maxPriceAge
        );
        console2.log("4. SynthController deployed    :", address(controller));

        // ── 5. Wire permissions ───────────────────────────────────────────────
        // 5a. Grant SynthController the MINTER_ROLE on SyntheticAsset
        synth.grantRole(synth.MINTER_ROLE(), address(controller));
        console2.log("5a. MINTER_ROLE granted to SynthController on SyntheticAsset");

        // 5b. Register SynthController as the authorised vault controller
        vault.setController(address(controller));
        console2.log("5b. CollateralVault controller set to SynthController");

        vm.stopBroadcast();

        // ── summary ───────────────────────────────────────────────────────────
        console2.log("");
        console2.log("=== Deployed Addresses ===");
        console2.log("PriceOracleAdapter :", address(oracle));
        console2.log("CollateralVault    :", address(vault));
        console2.log("SyntheticAsset     :", address(synth));
        console2.log("SynthController    :", address(controller));
        console2.log("");
        console2.log("Add these to your .env:");
        console2.log("ORACLE_ADDR=",      address(oracle));
        console2.log("VAULT_ADDR=",       address(vault));
        console2.log("SYNTH_ADDR=",       address(synth));
        console2.log("CONTROLLER_ADDR=",  address(controller));

        // ── verification assertions (fail-fast if wiring is wrong) ────────────
        require(
            synth.hasRole(synth.MINTER_ROLE(), address(controller)),
            "Deploy: MINTER_ROLE not set"
        );
        require(
            vault.controller() == address(controller),
            "Deploy: vault controller not set"
        );
        console2.log("");
        console2.log("All permission checks passed.");
    }
}
