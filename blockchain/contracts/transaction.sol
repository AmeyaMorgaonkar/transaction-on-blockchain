// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

error NotOwner();
error IncorrectPayment();
error AlreadyPurchased();

contract DigitalItem {
    address public owner;
    uint256 public price;
    uint256 public purchaseCount;

    struct Purchase {
        address buyer;
        uint256 amount;
        uint256 timestamp;
    }

    mapping(uint256 => Purchase) public purchases;
    mapping(address => bool) public hasPurchased;

    event ItemPurchased(address indexed buyer, uint256 amount);
    event PriceUpdated(uint256 newPrice);
    event Withdrawn(address indexed owner, uint256 amount);

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(uint256 _price) {
        owner = msg.sender;
        price = _price;
    }

    function buy() external payable {
        if (msg.value != price) revert IncorrectPayment();
        if (hasPurchased[msg.sender]) revert AlreadyPurchased();

        purchases[purchaseCount] = Purchase(
            msg.sender,
            msg.value,
            block.timestamp
        );

        hasPurchased[msg.sender] = true;
        purchaseCount++;

        emit ItemPurchased(msg.sender, msg.value);
    }

    function updatePrice(uint256 newPrice) external onlyOwner {
        price = newPrice;
        emit PriceUpdated(newPrice);
    }

    function withdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        payable(owner).transfer(balance);
        emit Withdrawn(owner, balance);
    }
}
