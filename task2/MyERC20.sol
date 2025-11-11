// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MyERC20 is IERC20 {

    uint256 private _totalSupply;
    mapping(address => uint256) private balances;
    mapping(address => mapping(address => uint256)) _allowances;
    address private _owner;
    constructor(uint256 supply) {
        _owner = msg.sender;
        _totalSupply = supply;
        balances[msg.sender] = supply;
    }

    modifier onlyOwner() {
        require(_owner == msg.sender);
        _;
    }

    function totalSupply() external view returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address account) external view returns (uint256) {
        return balances[account];
    }

    function transfer(address to, uint256 value) external returns (bool) {
        require(balances[msg.sender] >= value);
        balances[msg.sender] -= value;
        balances[to] += value;
        emit Transfer(msg.sender, to, value);
        return true;
    }

    function allowance(
        address owner,
        address spender
    ) external view returns (uint256) {
        return _allowances[owner][spender];
    }

    function approve(address spender, uint256 value) external returns (bool) {
        _allowances[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }

    function transferFrom(
        address from,
        address to,
        uint256 value
    ) external returns (bool) {
        uint256 currentAllowance = _allowances[from][msg.sender];
        if (currentAllowance < type(uint256).max) {
            require(currentAllowance >= value, "insufferent allowance");
            require(balances[from] >= currentAllowance, "insurffent balance");
            _allowances[from][msg.sender] -= value;
            balances[from] -= value;
            balances[to] += value;

            emit Transfer(from, to, value);
        }
        return true;
    }

    function mint(
        address to,
        uint256 amount
    ) external onlyOwner returns (bool) {
        _totalSupply += amount;
        balances[to] += amount;
        return true;
    }
}
