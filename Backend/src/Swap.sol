// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

contract AtherSwap is Ownable, Pausable, ReentrancyGuard {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    bytes32 public constant CLAIM_DOMAIN = keccak256("CLAIM_REWARD");

    address public backendSigner;
    bool public globalSwapEnabled;

    mapping(address => uint256) public nonces;
    mapping(address => bool) public blockedUsers;

    /* ========== ADMIN SYSTEM ========== */

    mapping(address => bool) public admins;
    address[] private adminList;

    /* ========== WITHDRAW SYSTEM ========== */

    struct WithdrawRequest {
        uint256 amount;
        address requestedBy;
        bool approvedByOwner;
        bool executed;
    }

    mapping(uint256 => WithdrawRequest) public withdrawRequests;
    uint256 public withdrawRequestCount;

    /* ========== EVENTS ========== */

    event RewardClaimed(address indexed user, uint256 amount, uint256 nonce);
    event UserBlocked(address indexed user);
    event UserUnblocked(address indexed user);
    event GlobalSwapStatusChanged(bool status);
    event BackendSignerChanged(address indexed oldSigner, address indexed newSigner);
    event EmergencyPaused();
    event EmergencyUnpaused();
    event WithdrawExecuted(uint256 amount);
    event NativeDeposited(address indexed from, uint256 amount);
    event AdminAdded(address indexed admin);
    event AdminRemoved(address indexed admin);
    event WithdrawRequested(uint256 indexed requestId, address indexed requestedBy, uint256 amount);
    event WithdrawApproved(uint256 indexed requestId, address indexed approvedBy);
    event WithdrawRejected(uint256 indexed requestId, address indexed rejectedBy);

    modifier onlyAdmin() {
        require(admins[msg.sender] || msg.sender == owner(), "Not authorized");
        _;
    }

    constructor(address _backendSigner) Ownable(msg.sender) {
        require(_backendSigner != address(0), "Invalid signer");
        backendSigner = _backendSigner;
        globalSwapEnabled = true;
    }

    /* ========== ADMIN MANAGEMENT ========== */

    function addAdmin(address _admin) external onlyOwner {
        require(_admin != address(0), "Invalid address");
        require(!admins[_admin], "Already admin");

        admins[_admin] = true;
        adminList.push(_admin);

        emit AdminAdded(_admin);
    }

    function removeAdmin(address _admin) external onlyOwner {
        require(admins[_admin], "Not admin");

        admins[_admin] = false;

        // Remove from array (swap & pop)
        for (uint256 i = 0; i < adminList.length; i++) {
            if (adminList[i] == _admin) {
                adminList[i] = adminList[adminList.length - 1];
                adminList.pop();
                break;
            }
        }

        emit AdminRemoved(_admin);
    }

    function getAllAdmins() external view onlyOwner returns (address[] memory) {
        return adminList;
    }

    function isAdmin(address user) external view returns (bool) {
        return admins[user];
    }

    function getAdminCount() external view returns (uint256) {
        return adminList.length;
    }

    /* ========== CORE CONTROLS ========== */

    function setGlobalSwap(bool status) external onlyOwner {
        globalSwapEnabled = status;
        emit GlobalSwapStatusChanged(status);
    }

    function setBackendSigner(address _newSigner) external onlyOwner {
        require(_newSigner != address(0), "Invalid signer");
        address oldSigner = backendSigner;
        backendSigner = _newSigner;
        emit BackendSignerChanged(oldSigner, _newSigner);
    }

    function blockUser(address user) external onlyOwner {
        require(user != address(0), "Invalid user");
        blockedUsers[user] = true;
        emit UserBlocked(user);
    }

    function unblockUser(address user) external onlyOwner {
        require(user != address(0), "Invalid user");
        blockedUsers[user] = false;
        emit UserUnblocked(user);
    }

    function pause() external onlyOwner {
        _pause();
        emit EmergencyPaused();
    }

    function unpause() external onlyOwner {
        _unpause();
        emit EmergencyUnpaused();
    }

    /* ========== CLAIM REWARD ========== */

    function claimReward(uint256 amount, bytes calldata signature)
        external
        whenNotPaused
        nonReentrant
    {
        require(globalSwapEnabled, "Global swap disabled");
        require(!blockedUsers[msg.sender], "User blocked");
        require(amount > 0, "Amount must be > 0");
        require(address(this).balance >= amount, "Insufficient liquidity");

        uint256 currentNonce = nonces[msg.sender];

        bytes32 messageHash = keccak256(
            abi.encode(
                CLAIM_DOMAIN,
                block.chainid,
                msg.sender,
                amount,
                currentNonce,
                address(this)
            )
        );

        bytes32 ethSignedMessageHash = messageHash.toEthSignedMessageHash();
        address signer = ECDSA.recover(ethSignedMessageHash, signature);

        require(signer == backendSigner, "Invalid signature");

        nonces[msg.sender] = currentNonce + 1;

        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "Reward transfer failed");

        emit RewardClaimed(msg.sender, amount, currentNonce);
    }

    /* ========== DEPOSIT ========== */

    function depositNative() external payable onlyAdmin {
        require(msg.value > 0, "Deposit must be > 0");
        emit NativeDeposited(msg.sender, msg.value);
    }

    /* ========== WITHDRAW REQUEST SYSTEM ========== */

    function requestWithdraw(uint256 amount) external onlyAdmin {
        require(amount > 0, "Amount must be > 0");
        require(address(this).balance >= amount, "Insufficient balance");

        withdrawRequests[withdrawRequestCount] = WithdrawRequest({
            amount: amount,
            requestedBy: msg.sender,
            approvedByOwner: false,
            executed: false
        });

        emit WithdrawRequested(withdrawRequestCount, msg.sender, amount);
        withdrawRequestCount++;
    }

    function approveWithdraw(uint256 requestId)
        external
        onlyOwner
        nonReentrant
    {
        WithdrawRequest storage request = withdrawRequests[requestId];

        require(request.amount > 0, "Invalid request");
        require(!request.executed, "Already executed");
        require(!request.approvedByOwner, "Already approved");
        require(address(this).balance >= request.amount, "Insufficient balance");

        request.approvedByOwner = true;
        request.executed = true;

        (bool success, ) = payable(request.requestedBy).call{value: request.amount}("");
        require(success, "Transfer failed");

        emit WithdrawApproved(requestId, msg.sender);
        emit WithdrawExecuted(request.amount);
    }

    function rejectWithdraw(uint256 requestId) external onlyOwner {
        WithdrawRequest storage request = withdrawRequests[requestId];

        require(request.amount > 0, "Invalid request");
        require(!request.executed, "Already executed");

        request.executed = true;

        emit WithdrawRejected(requestId, msg.sender);
    }

    /* ========== OWNER DIRECT WITHDRAW ========== */

    function withdrawNative(uint256 amount)
        external
        onlyOwner
        nonReentrant
    {
        require(address(this).balance >= amount, "Insufficient balance");

        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "Native withdraw failed");

        emit WithdrawExecuted(amount);
    }

    /* ========== VIEW ========== */

    function getTotalBalance() external view returns (uint256) {
        return address(this).balance;
    }

    receive() external payable {
        emit NativeDeposited(msg.sender, msg.value);
    }
}