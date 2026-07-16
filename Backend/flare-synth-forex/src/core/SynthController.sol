// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {CollateralVault} from "./CollateralVault.sol";
import {SyntheticAsset} from "./SyntheticAsset.sol";
import {IPriceOracle} from "../oracle/IPriceOracle.sol";

contract SynthController is Ownable, Pausable, ReentrancyGuard {
    using Address for address payable;
    using SafeERC20 for IERC20;

    uint256 public constant BASIS_POINTS = 10_000;

    error InvalidAddress(address account);
    error InvalidThreshold(uint256 value);
    error ZeroAmount();
    error InsufficientDebt(address user, uint256 available, uint256 requested);
    error InsufficientCollateralization(
        address user,
        uint256 collateralRatioBps,
        uint256 minimumCollateralRatioBps
    );
    error PositionHealthy(address user, uint256 collateralRatioBps);
    error InvalidOraclePrice(uint256 price);
    error InvalidOracleDecimals(int8 decimals);
    error InvalidOracleTimestamp(uint64 timestamp);
    error ExcessiveLiquidationRepayment(uint256 maxRepayable, uint256 requested);
    error LiquidationShortfall(
        address user,
        uint256 seizedCollateralUsd18,
        uint256 requiredCollateralUsd18
    );
    // H3: explicit error for collateral value underflow
    error InsufficientCollateralValue(
        address user,
        uint256 currentValueUsd18,
        uint256 withdrawalValueUsd18
    );
    // H2/M1: staleness error
    error StalePriceData(uint64 timestamp, uint256 currentTime, uint256 maxAge);
    event OracleUpdated(address indexed previousOracle, address indexed newOracle);
    event MinimumCollateralRatioUpdated(
        uint256 previousRatioBps,
        uint256 newRatioBps
    );
    event LiquidationBonusUpdated(
        uint256 previousBonusBps,
        uint256 newBonusBps
    );
    event MaxPriceAgeUpdated(uint256 previousMaxAge, uint256 newMaxAge);
    event FxEurMinted(
        address indexed user,
        uint256 amount,
        uint256 totalDebt
    );
    event FxEurBurned(
        address indexed user,
        uint256 amount,
        uint256 remainingDebt
    );
    event CollateralReleased(
        address indexed user,
        address indexed token,
        uint256 amount
    );
    event PositionLiquidated(
        address indexed liquidator,
        address indexed user,
        uint256 debtRepaid,
        uint256 collateralSeizedUsd18
    );
    event NativeRecovered(address indexed recipient, uint256 amount);

    CollateralVault public immutable collateralVault;
    SyntheticAsset public immutable syntheticAsset;
    IPriceOracle public priceOracle;

    uint256 public minimumCollateralRatioBps;
    uint256 public liquidationBonusBps;
    /// @notice H2/M1: controller-level staleness cap. Oracle adapters also
    ///         enforce staleness, but this provides defence-in-depth against
    ///         a future oracle that omits the check.
    uint256 public maxPriceAge;

    mapping(address user => uint256 debtAmount) public debtPositions;

    constructor(
        address vault,
        address synth,
        address oracle,
        uint256 initialMinimumCollateralRatioBps,
        uint256 initialLiquidationBonusBps,
        uint256 initialMaxPriceAge
    ) Ownable(msg.sender) {
        if (vault == address(0) || synth == address(0) || oracle == address(0)) {
            revert InvalidAddress(address(0));
        }
        if (initialMinimumCollateralRatioBps < BASIS_POINTS) {
            revert InvalidThreshold(initialMinimumCollateralRatioBps);
        }
        if (initialLiquidationBonusBps >= BASIS_POINTS) {
            revert InvalidThreshold(initialLiquidationBonusBps);
        }
        if (initialMaxPriceAge == 0) {
            revert InvalidThreshold(initialMaxPriceAge);
        }

        collateralVault = CollateralVault(vault);
        syntheticAsset = SyntheticAsset(synth);
        priceOracle = IPriceOracle(oracle);
        minimumCollateralRatioBps = initialMinimumCollateralRatioBps;
        liquidationBonusBps = initialLiquidationBonusBps;
        maxPriceAge = initialMaxPriceAge;
    }

    function setPriceOracle(address newOracle) external onlyOwner {
        if (newOracle == address(0)) {
            revert InvalidAddress(newOracle);
        }

        emit OracleUpdated(address(priceOracle), newOracle);
        priceOracle = IPriceOracle(newOracle);
    }

    function setMinimumCollateralRatioBps(
        uint256 newMinimumCollateralRatioBps
    ) external onlyOwner {
        if (newMinimumCollateralRatioBps < BASIS_POINTS) {
            revert InvalidThreshold(newMinimumCollateralRatioBps);
        }

        emit MinimumCollateralRatioUpdated(
            minimumCollateralRatioBps,
            newMinimumCollateralRatioBps
        );
        minimumCollateralRatioBps = newMinimumCollateralRatioBps;
    }

    function setMaxPriceAge(uint256 newMaxPriceAge) external onlyOwner {
        if (newMaxPriceAge == 0) {
            revert InvalidThreshold(newMaxPriceAge);
        }
        emit MaxPriceAgeUpdated(maxPriceAge, newMaxPriceAge);
        maxPriceAge = newMaxPriceAge;
    }

    function setLiquidationBonusBps(
        uint256 newLiquidationBonusBps
    ) external onlyOwner {
        if (newLiquidationBonusBps >= BASIS_POINTS) {
            revert InvalidThreshold(newLiquidationBonusBps);
        }

        emit LiquidationBonusUpdated(
            liquidationBonusBps,
            newLiquidationBonusBps
        );
        liquidationBonusBps = newLiquidationBonusBps;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function mint(uint256 amount) external payable whenNotPaused nonReentrant {
        if (amount == 0) {
            revert ZeroAmount();
        }

        (uint256 price, int8 decimals) = _readOraclePrice(msg.value);
        uint256 collateralValueUsd18 = collateralVault.getTotalCollateralValue(
            msg.sender
        );
        uint256 newDebtAmount = debtPositions[msg.sender] + amount;
        uint256 collateralRatioBps = _calculateCollateralRatioBps(
            collateralValueUsd18,
            newDebtAmount,
            price,
            decimals
        );

        if (collateralRatioBps < minimumCollateralRatioBps) {
            revert InsufficientCollateralization(
                msg.sender,
                collateralRatioBps,
                minimumCollateralRatioBps
            );
        }

        debtPositions[msg.sender] = newDebtAmount;
        syntheticAsset.mint(msg.sender, amount);

        emit FxEurMinted(msg.sender, amount, newDebtAmount);
    }

    function burn(uint256 amount) external whenNotPaused nonReentrant {
        if (amount == 0) {
            revert ZeroAmount();
        }

        uint256 currentDebt = debtPositions[msg.sender];
        if (amount > currentDebt) {
            revert InsufficientDebt(msg.sender, currentDebt, amount);
        }

        IERC20(address(syntheticAsset)).safeTransferFrom(
            msg.sender,
            address(this),
            amount
        );
        uint256 remainingDebt = currentDebt - amount;
        debtPositions[msg.sender] = remainingDebt;
        syntheticAsset.burn(address(this), amount);

        emit FxEurBurned(msg.sender, amount, remainingDebt);
    }

    function withdrawCollateral(
        address token,
        uint256 amount
    ) external payable whenNotPaused nonReentrant {
        if (amount == 0) {
            revert ZeroAmount();
        }

        (uint256 price, int8 decimals) = _readOraclePrice(msg.value);
        uint256 currentCollateralValueUsd18 = collateralVault.getTotalCollateralValue(
            msg.sender
        );
        uint256 withdrawalValueUsd18 = collateralVault.normalizeCollateralAmount(
            token,
            amount
        );
        // H3 FIX: guard against underflow before subtraction.
        // Without this, a withdrawal larger than total collateral would panic-revert
        // with an unhelpful arithmetic underflow instead of a descriptive error.
        if (withdrawalValueUsd18 > currentCollateralValueUsd18) {
            revert InsufficientCollateralValue(
                msg.sender,
                currentCollateralValueUsd18,
                withdrawalValueUsd18
            );
        }
        uint256 updatedCollateralValueUsd18 =
            currentCollateralValueUsd18 -
            withdrawalValueUsd18;
        uint256 collateralRatioBps = _calculateCollateralRatioBps(
            updatedCollateralValueUsd18,
            debtPositions[msg.sender],
            price,
            decimals
        );

        if (
            debtPositions[msg.sender] != 0 &&
            collateralRatioBps < minimumCollateralRatioBps
        ) {
            revert InsufficientCollateralization(
                msg.sender,
                collateralRatioBps,
                minimumCollateralRatioBps
            );
        }

        collateralVault.controllerWithdraw(msg.sender, token, amount, msg.sender);

        emit CollateralReleased(msg.sender, token, amount);
    }

    function getCollateralRatio(
        address user
    ) external payable whenNotPaused returns (uint256 collateralRatioBps) {
        (uint256 price, int8 decimals) = _readOraclePrice(msg.value);
        collateralRatioBps = _calculateCollateralRatioBps(
            collateralVault.getTotalCollateralValue(user),
            debtPositions[user],
            price,
            decimals
        );
    }

    function liquidate(
        address user,
        uint256 debtToRepay
    ) external payable whenNotPaused nonReentrant {
        if (debtToRepay == 0) {
            revert ZeroAmount();
        }

        (uint256 price, int8 decimals) = _readOraclePrice(msg.value);
        uint256 currentDebt = debtPositions[user];
        if (debtToRepay > currentDebt) {
            revert InsufficientDebt(user, currentDebt, debtToRepay);
        }

        uint256 collateralValueUsd18 = collateralVault.getTotalCollateralValue(user);
        uint256 collateralRatioBps = _calculateCollateralRatioBps(
            collateralValueUsd18,
            currentDebt,
            price,
            decimals
        );

        if (collateralRatioBps >= minimumCollateralRatioBps) {
            revert PositionHealthy(user, collateralRatioBps);
        }

        uint256 maxRepayable = _calculateMaxRepayableDebt(
            collateralValueUsd18,
            price,
            decimals
        );
        if (debtToRepay > maxRepayable) {
            revert ExcessiveLiquidationRepayment(maxRepayable, debtToRepay);
        }

        IERC20(address(syntheticAsset)).safeTransferFrom(
            msg.sender,
            address(this),
            debtToRepay
        );
        debtPositions[user] = currentDebt - debtToRepay;
        syntheticAsset.burn(address(this), debtToRepay);

        uint256 debtValueUsd18 = _convertFxEurToUsd18(debtToRepay, price, decimals);
        uint256 collateralToSeizeUsd18 =
            (debtValueUsd18 * (BASIS_POINTS + liquidationBonusBps)) /
            BASIS_POINTS;
        uint256 seizedCollateralUsd18 = _seizeCollateral(
            user,
            msg.sender,
            collateralToSeizeUsd18
        );

        emit PositionLiquidated(
            msg.sender,
            user,
            debtToRepay,
            seizedCollateralUsd18
        );
    }

    function recoverNative(address payable recipient) external onlyOwner nonReentrant {
        if (recipient == address(0)) {
            revert InvalidAddress(recipient);
        }

        uint256 balance = address(this).balance;
        if (balance != 0) {
            recipient.sendValue(balance);
            emit NativeRecovered(recipient, balance);
        }
    }

    function _calculateCollateralRatioBps(
        uint256 collateralValueUsd18,
        uint256 debtAmount,
        uint256 eurUsdPrice,
        int8 oracleDecimals
    ) internal pure returns (uint256) {
        if (debtAmount == 0) {
            return type(uint256).max;
        }

        uint256 debtValueUsd18 = _convertFxEurToUsd18(
            debtAmount,
            eurUsdPrice,
            oracleDecimals
        );
        return (collateralValueUsd18 * BASIS_POINTS) / debtValueUsd18;
    }

    function _convertFxEurToUsd18(
        uint256 fxEurAmount,
        uint256 eurUsdPrice,
        int8 oracleDecimals
    ) internal pure returns (uint256) {
        if (eurUsdPrice == 0) {
            revert InvalidOraclePrice(eurUsdPrice);
        }

        uint256 scale = _oracleScale(oracleDecimals);
        return (fxEurAmount * eurUsdPrice) / scale;
    }

    function _calculateMaxRepayableDebt(
        uint256 collateralValueUsd18,
        uint256 eurUsdPrice,
        int8 oracleDecimals
    ) internal view returns (uint256) {
        uint256 scale = _oracleScale(oracleDecimals);
        return
            Math.mulDiv(
                collateralValueUsd18,
                BASIS_POINTS * scale,
                (BASIS_POINTS + liquidationBonusBps) * eurUsdPrice
            );
    }

    function _seizeCollateral(
        address user,
        address recipient,
        uint256 collateralToSeizeUsd18
    ) internal returns (uint256 seizedCollateralUsd18) {
        address[] memory tokens = collateralVault.getSupportedTokens();
        uint256 remainingCollateralUsd18 = collateralToSeizeUsd18;

        for (uint256 i = 0; i < tokens.length && remainingCollateralUsd18 > 0; ++i) {
            address token = tokens[i];
            uint256 tokenBalance = collateralVault.getCollateralBalance(user, token);
            if (tokenBalance == 0) {
                continue;
            }

            uint256 tokenValueUsd18 = collateralVault.normalizeCollateralAmount(
                token,
                tokenBalance
            );

            uint256 amountToWithdraw = tokenBalance;
            if (tokenValueUsd18 > remainingCollateralUsd18) {
                amountToWithdraw = collateralVault.denormalizeCollateralAmount(
                    token,
                    remainingCollateralUsd18,
                    true
                );
                if (amountToWithdraw > tokenBalance) {
                    amountToWithdraw = tokenBalance;
                }
            }

            uint256 withdrawnValueUsd18 = collateralVault.normalizeCollateralAmount(
                token,
                amountToWithdraw
            );
            collateralVault.controllerWithdraw(
                user,
                token,
                amountToWithdraw,
                recipient
            );

            seizedCollateralUsd18 += withdrawnValueUsd18;
            if (withdrawnValueUsd18 >= remainingCollateralUsd18) {
                remainingCollateralUsd18 = 0;
            } else {
                remainingCollateralUsd18 -= withdrawnValueUsd18;
            }
        }

        if (remainingCollateralUsd18 != 0) {
            revert LiquidationShortfall(
                user,
                seizedCollateralUsd18,
                collateralToSeizeUsd18
            );
        }
    }

    function _oracleScale(int8 oracleDecimals) internal pure returns (uint256) {
        if (oracleDecimals < 0 || oracleDecimals > 18) {
            revert InvalidOracleDecimals(oracleDecimals);
        }

        // forge-lint: disable-next-line(unsafe-typecast)
        return 10 ** uint256(int256(oracleDecimals));
    }

    function _readOraclePrice(
        uint256 oracleFee
    ) internal returns (uint256 price, int8 decimals) {
        uint64 timestamp;
        (price, decimals, timestamp) = priceOracle.getPrice{value: oracleFee}();
        if (price == 0) {
            revert InvalidOraclePrice(price);
        }
        if (timestamp == 0 || timestamp > block.timestamp) {
            revert InvalidOracleTimestamp(timestamp);
        }
        // H2/M1 FIX: controller-level staleness enforcement.
        // Even if the oracle adapter performs its own check, the oracle is
        // mutable (setPriceOracle). A replacement oracle that omits the
        // staleness check would silently accept stale data without this guard.
        if (block.timestamp - uint256(timestamp) > maxPriceAge) {
            revert StalePriceData(timestamp, block.timestamp, maxPriceAge);
        }
    }
}
