// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract CollateralVault is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    error InvalidToken(address token);
    error InvalidController(address controller);
    error UnsupportedCollateralToken(address token);
    error UnauthorizedController(address caller);
    error InsufficientCollateralBalance(
        address user,
        address token,
        uint256 available,
        uint256 requested
    );

    event ControllerUpdated(
        address indexed previousController,
        address indexed newController
    );
    event CollateralDeposited(
        address indexed user,
        address indexed token,
        uint256 amount
    );
    event CollateralWithdrawn(
        address indexed user,
        address indexed token,
        uint256 amount,
        address indexed recipient
    );

    address public controller;

    address[] private supportedTokens;
    mapping(address token => bool) public isSupportedToken;
    mapping(address token => uint8) private tokenDecimals;
    mapping(address user => mapping(address token => uint256 amount))
        private collateralBalances;

    constructor(address[] memory collateralTokens) Ownable(msg.sender) {
        uint256 tokenCount = collateralTokens.length;
        for (uint256 i = 0; i < tokenCount; ++i) {
            address token = collateralTokens[i];
            uint8 dec = IERC20Metadata(token).decimals();
            if (
                token == address(0) ||
                isSupportedToken[token] ||
                dec == 0 ||
                dec > 18
            ) {
                revert InvalidToken(token);
            }

            isSupportedToken[token] = true;
            tokenDecimals[token] = dec;
            supportedTokens.push(token);
        }
    }

    modifier onlyController() {
        if (msg.sender != controller) {
            revert UnauthorizedController(msg.sender);
        }
        _;
    }

    function setController(address newController) external onlyOwner {
        if (newController == address(0)) {
            revert InvalidController(newController);
        }

        // L4 FIX: capture previous value before write, then emit correct (old→new)
        address previousController = controller;
        controller = newController;
        emit ControllerUpdated(previousController, newController);
    }

    function deposit(address token, uint256 amount) external nonReentrant {
        _requireSupportedToken(token);
        if (amount == 0) revert InsufficientCollateralBalance(msg.sender, token, 0, amount);

        // H1 FIX: Correct CEI — transfer first, then update balance.
        // This prevents a re-entrant token from calling deposit() again
        // before the first transfer has settled, which would double-credit
        // the caller's balance.
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        collateralBalances[msg.sender][token] += amount;

        emit CollateralDeposited(msg.sender, token, amount);
    }

    function controllerWithdraw(
        address user,
        address token,
        uint256 amount,
        address recipient
    ) external onlyController nonReentrant {
        _requireSupportedToken(token);

        uint256 availableBalance = collateralBalances[user][token];
        if (amount > availableBalance) {
            revert InsufficientCollateralBalance(
                user,
                token,
                availableBalance,
                amount
            );
        }

        collateralBalances[user][token] = availableBalance - amount;
        IERC20(token).safeTransfer(recipient, amount);

        emit CollateralWithdrawn(user, token, amount, recipient);
    }

    function getCollateralBalance(
        address user,
        address token
    ) external view returns (uint256) {
        return collateralBalances[user][token];
    }

    function getSupportedTokens() external view returns (address[] memory) {
        return supportedTokens;
    }

    function getTokenDecimals(address token) external view returns (uint8) {
        _requireSupportedToken(token);
        return tokenDecimals[token];
    }

    function getTotalCollateralValue(
        address user
    ) external view returns (uint256 totalValueUsd18) {
        uint256 tokenCount = supportedTokens.length;
        for (uint256 i = 0; i < tokenCount; ++i) {
            address token = supportedTokens[i];
            totalValueUsd18 += normalizeCollateralAmount(
                token,
                collateralBalances[user][token]
            );
        }
    }

    function normalizeCollateralAmount(
        address token,
        uint256 amount
    ) public view returns (uint256) {
        _requireSupportedToken(token);
        return amount * (10 ** (18 - tokenDecimals[token]));
    }

    function denormalizeCollateralAmount(
        address token,
        uint256 amountUsd18,
        bool roundUp
    ) public view returns (uint256) {
        _requireSupportedToken(token);

        uint256 scale = 10 ** (18 - tokenDecimals[token]);
        if (!roundUp) {
            return amountUsd18 / scale;
        }

        return (amountUsd18 + scale - 1) / scale;
    }

    function _requireSupportedToken(address token) internal view {
        if (!isSupportedToken[token]) {
            revert UnsupportedCollateralToken(token);
        }
    }
}
