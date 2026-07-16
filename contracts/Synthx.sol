// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title SynthAsset
 * @dev A standard ERC20 token representing a synthetic asset.
 * Only the Synthx protocol contract has permission to mint or burn these tokens.
 */
contract SynthAsset is ERC20, Ownable {
    constructor(string memory name, string memory symbol, address protocol) 
        ERC20(name, symbol) 
        Ownable(protocol) 
    {}

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    function burnFrom(address from, uint256 amount) external onlyOwner {
        _burn(from, amount);
    }
}

/**
 * @title Synthx Factory & Protocol
 * @dev This contract deploys and manages 8 synthetic fiat currencies as standard ERC20 tokens.
 */
contract Synthx {
    address public owner;
    
    // User balances of collateral (FLR)
    mapping(address => uint256) public collateralBalances;

    // Reserve LP share accounting for protocol liquidity providers
    mapping(address => uint256) public reserveShares;
    uint256 public totalReserveShares;
    
    // Oracle Prices (scaled by 1e18 for precision)
    mapping(string => uint256) public assetPrices;

    // Registry of deployed SynthAsset ERC20 contracts (symbol => address)
    mapping(string => address) public synthTokens;
    string[] private synthAssetIds;

    event CollateralDeposited(address indexed user, uint256 amount);
    event SynthMinted(address indexed user, string assetSymbol, address tokenAddress, uint256 amountMinted, uint256 collateralLocked);
    event PriceUpdated(string assetSymbol, uint256 newPrice);
    event SynthTokenCreated(string assetSymbol, address tokenAddress);
    event SynthBurned(address indexed user, string assetSymbol, uint256 amountBurned, uint256 collateralUnlocked);
    event ReserveProvided(address indexed provider, uint256 amount, uint256 sharesMinted);
    event ReserveWithdrawn(address indexed provider, uint256 amount, uint256 sharesBurned);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    // Allow the contract to receive raw FLR to act as a liquidity buffer for profitable traders
    receive() external payable {}

    constructor() {
        owner = msg.sender;
        
        // 1. Set initial mock prices (1 USD = X Asset)
        assetPrices["seur"] = 922339000000000000;  // 0.922 EUR
        assetPrices["sgbp"] = 786000000000000000;  // 0.786 GBP
        assetPrices["sjpy"] = 157420000000000000000; // 157.42 JPY
        assetPrices["schf"] = 901200000000000000;  // 0.9012 CHF
        assetPrices["saud"] = 1520000000000000000; // 1.52 AUD
        assetPrices["scad"] = 1361200000000000000; // 1.3612 CAD
        assetPrices["snzd"] = 1630000000000000000; // 1.63 NZD
        assetPrices["scny"] = 7254100000000000000; // 7.2541 CNY

        // 2. Deploy the ERC20 contracts for each synthetic asset
        _deploySynth("seur", "Synthetic Euro", "sEUR");
        _deploySynth("sgbp", "Synthetic British Pound", "sGBP");
        _deploySynth("sjpy", "Synthetic Japanese Yen", "sJPY");
        _deploySynth("schf", "Synthetic Swiss Franc", "sCHF");
        _deploySynth("saud", "Synthetic Australian Dollar", "sAUD");
        _deploySynth("scad", "Synthetic Canadian Dollar", "sCAD");
        _deploySynth("snzd", "Synthetic New Zealand Dollar", "sNZD");
        _deploySynth("scny", "Synthetic Chinese Yuan", "sCNY");
    }

    function _deploySynth(string memory id, string memory name, string memory symbol) internal {
        SynthAsset newToken = new SynthAsset(name, symbol, address(this));
        synthTokens[id] = address(newToken);
        synthAssetIds.push(id);
        emit SynthTokenCreated(id, address(newToken));
    }

    function updatePrice(string memory assetSymbol, uint256 newPrice) external onlyOwner {
        assetPrices[assetSymbol] = newPrice;
        emit PriceUpdated(assetSymbol, newPrice);
    }

    function depositCollateral() external payable {
        require(msg.value > 0, "Must deposit more than 0");
        collateralBalances[msg.sender] += msg.value;
        emit CollateralDeposited(msg.sender, msg.value);
    }

    function mintSynth(string memory assetSymbol, uint256 flrAmountToLock) external payable {
        require(flrAmountToLock > 0, "Amount must be greater than 0");
        require(msg.value == flrAmountToLock, "Send exact FLR collateral");
        require(assetPrices[assetSymbol] > 0, "Asset price not available");
        require(synthTokens[assetSymbol] != address(0), "Token contract not found");

        uint256 amountToMint = (flrAmountToLock * assetPrices[assetSymbol]) / 1e18;

        // The FLR collateral stays locked in this contract; mint the synth to the user's wallet.
        SynthAsset(synthTokens[assetSymbol]).mint(msg.sender, amountToMint);
        
        emit SynthMinted(msg.sender, assetSymbol, synthTokens[assetSymbol], amountToMint, flrAmountToLock);
    }

    function burnSynth(string memory assetSymbol, uint256 synthAmountToBurn) external {
        require(synthTokens[assetSymbol] != address(0), "Token contract not found");
        require(assetPrices[assetSymbol] > 0, "Asset price not available");
        require(synthAmountToBurn > 0, "Amount must be greater than 0");

        // Calculate how much FLR is unlocked
        // synthAmount = (flrAmount * price) / 1e18 => flrAmount = (synthAmount * 1e18) / price
        uint256 flrAmountToUnlock = (synthAmountToBurn * 1e18) / assetPrices[assetSymbol];

        // Burn standard ERC20 tokens from the user's wallet
        // Because the Factory is the Owner of the ERC20, it can forcefully burn without allowance
        SynthAsset(synthTokens[assetSymbol]).burnFrom(msg.sender, synthAmountToBurn);

        require(address(this).balance >= flrAmountToUnlock + _getRequiredLiquidity(), "Insufficient FLR liquidity");

        // Return the unlocked native FLR directly to the same wallet that burned the synth.
        (bool success, ) = msg.sender.call{value: flrAmountToUnlock}("");
        require(success, "FLR transfer failed");

        emit SynthBurned(msg.sender, assetSymbol, synthAmountToBurn, flrAmountToUnlock);
    }

    function withdrawCollateral(uint256 amount) external {
        require(collateralBalances[msg.sender] >= amount, "Insufficient collateral balance");
        collateralBalances[msg.sender] -= amount;

        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "FLR transfer failed");
    }

    function provideReserve() external payable {
        require(msg.value > 0, "Must provide more than 0");

        uint256 reserveValueBefore = _getAvailableReserveLiquidity(address(this).balance - msg.value);
        uint256 sharesToMint;

        if (totalReserveShares == 0 || reserveValueBefore == 0) {
            sharesToMint = msg.value;
        } else {
            sharesToMint = (msg.value * totalReserveShares) / reserveValueBefore;
        }

        reserveShares[msg.sender] += sharesToMint;
        totalReserveShares += sharesToMint;

        emit ReserveProvided(msg.sender, msg.value, sharesToMint);
    }

    function withdrawReserve(uint256 shareAmount) external {
        require(shareAmount > 0, "Must withdraw more than 0");
        require(reserveShares[msg.sender] >= shareAmount, "Insufficient reserve shares");

        uint256 reserveValue = _getAvailableReserveLiquidity(address(this).balance);
        require(reserveValue > 0, "No reserve liquidity available");

        uint256 amountToWithdraw = (shareAmount * reserveValue) / totalReserveShares;
        require(amountToWithdraw > 0, "Withdrawal amount is 0");

        reserveShares[msg.sender] -= shareAmount;
        totalReserveShares -= shareAmount;

        (bool success, ) = msg.sender.call{value: amountToWithdraw}("");
        require(success, "FLR transfer failed");

        emit ReserveWithdrawn(msg.sender, amountToWithdraw, shareAmount);
    }

    function previewReserveWithdrawal(uint256 shareAmount) external view returns (uint256) {
        if (shareAmount == 0 || totalReserveShares == 0) {
            return 0;
        }

        uint256 reserveValue = _getAvailableReserveLiquidity(address(this).balance);
        return (shareAmount * reserveValue) / totalReserveShares;
    }

    function getRequiredLiquidity() external view returns (uint256) {
        return _getRequiredLiquidity();
    }

    function getAvailableReserveLiquidity() external view returns (uint256) {
        return _getAvailableReserveLiquidity(address(this).balance);
    }

    // Returns the current FLR liquidity held by the contract
    function getLiquidity() external view returns (uint256) {
        return address(this).balance;
    }

    function _getRequiredLiquidity() internal view returns (uint256 totalRequired) {
        for (uint256 i = 0; i < synthAssetIds.length; i++) {
            string memory assetId = synthAssetIds[i];
            uint256 price = assetPrices[assetId];
            if (price == 0) {
                continue;
            }

            uint256 totalSupply = SynthAsset(synthTokens[assetId]).totalSupply();
            if (totalSupply == 0) {
                continue;
            }

            totalRequired += (totalSupply * 1e18) / price;
        }
    }

    function _getAvailableReserveLiquidity(uint256 balance) internal view returns (uint256) {
        uint256 requiredLiquidity = _getRequiredLiquidity();
        if (balance <= requiredLiquidity) {
            return 0;
        }
        return balance - requiredLiquidity;
    }
}
