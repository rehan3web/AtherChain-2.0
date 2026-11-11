// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract WrappedNative {

    string public name = "Wrapped ATH";
    string public symbol = "WATH";
    uint8 public decimals = 18;

    uint256 public totalSupply;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    // ===== EVENTS =====
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Deposit(address indexed user, uint256 amount);
    event Withdrawal(address indexed user, uint256 amount);

    // ===== RECEIVE NATIVE =====
    receive() external payable {
        deposit();
    }

    // ===== DEPOSIT (MINT) =====
    function deposit() public payable {
        require(msg.value > 0, "Zero deposit");

        _mint(msg.sender, msg.value);

        emit Deposit(msg.sender, msg.value);
    }

    // ===== WITHDRAW (BURN) =====
    function withdraw(uint256 amount) external {
        require(balanceOf[msg.sender] >= amount, "Insufficient balance");

        _burn(msg.sender, amount);

        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "Native transfer failed");

        emit Withdrawal(msg.sender, amount);
    }

    // ===== ERC20 FUNCTIONS =====

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {

        uint256 allowed = allowance[from][msg.sender];
        require(allowed >= amount, "Allowance exceeded");

        if (allowed != type(uint256).max) {
            allowance[from][msg.sender] -= amount;
        }

        _transfer(from, to, amount);
        return true;
    }

    // ===== INTERNAL LOGIC =====

    function _transfer(address from, address to, uint256 amount) internal {
        require(balanceOf[from] >= amount, "Insufficient balance");

        balanceOf[from] -= amount;
        balanceOf[to] += amount;

        emit Transfer(from, to, amount);
    }

    function _mint(address to, uint256 amount) internal {
        totalSupply += amount;
        balanceOf[to] += amount;

        emit Transfer(address(0), to, amount);
    }

    function _burn(address from, uint256 amount) internal {
        require(balanceOf[from] >= amount, "Insufficient balance");

        balanceOf[from] -= amount;
        totalSupply -= amount;

        emit Transfer(from, address(0), amount);
    }
}