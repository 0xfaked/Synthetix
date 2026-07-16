// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {SyntheticAsset} from "../src/core/SyntheticAsset.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";

/// @notice SyntheticAsset unit tests — access control on mint/burn.
contract SyntheticAssetTest is Test {
    SyntheticAsset internal synth;

    address internal admin   = makeAddr("admin");
    address internal minter  = makeAddr("minter");
    address internal attacker = makeAddr("attacker");

    function setUp() public {
        synth = new SyntheticAsset(admin);

        // Grant MINTER_ROLE to `minter` from admin
        vm.prank(admin);
        synth.grantRole(synth.MINTER_ROLE(), minter);
    }

    // ─── mint ─────────────────────────────────────────────────────────────────

    function testMint_byMinter() public {
        vm.prank(minter);
        synth.mint(admin, 100e18);
        assertEq(synth.balanceOf(admin), 100e18);
        assertEq(synth.totalSupply(), 100e18);
    }

    function testMint_byAttackerReverts() public {
        vm.prank(attacker);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector,
                attacker,
                synth.MINTER_ROLE()
            )
        );
        synth.mint(attacker, 100e18);
    }

    function testMint_byAdminWithoutMinterRoleReverts() public {
        // DEFAULT_ADMIN_ROLE ≠ MINTER_ROLE
        vm.prank(admin);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector,
                admin,
                synth.MINTER_ROLE()
            )
        );
        synth.mint(admin, 1e18);
    }

    // ─── burn ─────────────────────────────────────────────────────────────────

    function testBurn_byMinter() public {
        vm.prank(minter);
        synth.mint(minter, 500e18);

        vm.prank(minter);
        synth.burn(minter, 200e18);

        assertEq(synth.balanceOf(minter), 300e18);
        assertEq(synth.totalSupply(), 300e18);
    }

    function testBurn_byAttackerReverts() public {
        vm.prank(minter);
        synth.mint(minter, 100e18);

        vm.prank(attacker);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector,
                attacker,
                synth.MINTER_ROLE()
            )
        );
        synth.burn(minter, 100e18);
    }

    function testBurn_excessReverts() public {
        vm.prank(minter);
        synth.mint(minter, 100e18);

        vm.prank(minter);
        vm.expectRevert(); // ERC20InsufficientBalance
        synth.burn(minter, 101e18);
    }

    // ─── role management ──────────────────────────────────────────────────────

    function testGrantMinterRole() public {
        address newMinter = makeAddr("newMinter");

        vm.prank(admin);
        synth.grantRole(synth.MINTER_ROLE(), newMinter);

        assertTrue(synth.hasRole(synth.MINTER_ROLE(), newMinter));

        vm.prank(newMinter);
        synth.mint(admin, 1e18);
        assertEq(synth.balanceOf(admin), 1e18);
    }

    function testRevokeMinterRole() public {
        // Revoke minter's role
        vm.prank(admin);
        synth.revokeRole(synth.MINTER_ROLE(), minter);

        assertFalse(synth.hasRole(synth.MINTER_ROLE(), minter));

        vm.prank(minter);
        vm.expectRevert();
        synth.mint(admin, 1e18);
    }

    function testGrantRole_byNonAdminReverts() public {
        vm.prank(attacker);
        vm.expectRevert();
        synth.grantRole(synth.MINTER_ROLE(), attacker);
    }

    // ─── constructor ──────────────────────────────────────────────────────────

    function testConstructor_zeroAdminReverts() public {
        vm.expectRevert(abi.encodeWithSelector(SyntheticAsset.InvalidAdmin.selector, address(0)));
        new SyntheticAsset(address(0));
    }

    function testConstructor_adminHasAdminRole() public view {
        assertTrue(synth.hasRole(synth.DEFAULT_ADMIN_ROLE(), admin));
    }

    function testConstructor_adminNotMinter() public view {
        assertFalse(synth.hasRole(synth.MINTER_ROLE(), admin));
    }

    // ─── ERC20 metadata ───────────────────────────────────────────────────────

    function testMetadata() public view {
        assertEq(synth.name(),   "fxEUR");
        assertEq(synth.symbol(), "fxEUR");
        assertEq(synth.decimals(), 18);
    }
}
