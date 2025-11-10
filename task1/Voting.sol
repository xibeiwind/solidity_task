// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

contract Voting {
    mapping(string => uint256) private votes;
    

    event Voted(string candidate, uint256 votes);

    function vote(string memory candidate) external {
        votes[candidate]++;
        emit Voted(candidate, votes[candidate]);
    }

    function getVotes(string memory candidate) external view returns (uint256) {
        return votes[candidate];
    }

    function resetVotes(string[] memory candidates) external {
        for (uint256 i = 0; i < candidates.length; i++) {
            votes[candidates[i]] = 0;
        }
    }
}
