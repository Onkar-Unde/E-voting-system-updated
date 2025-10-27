// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

contract EVoting {
    address public admin;

    struct Candidate {
        uint id;
        string name;
        uint voteCount;
    }

    mapping(uint => Candidate) public candidates;
    uint public candidatesCount;

    mapping(bytes32 => bool) public hasVoted;
    mapping(bytes32 => bool) public registeredVoters;

    event VoteRecorded(uint indexed candidateId, bytes32 indexed identityHash, address indexed by);
    event CandidateAdded(uint indexed id, string name);
    event IdentityRegistered(bytes32 indexed identityHash);

    modifier onlyAdmin() {
        require(msg.sender == admin, "admin only");
        _;
    }

    constructor() {
        admin = msg.sender;
    }

    function addCandidate(string memory _name) public onlyAdmin {
        candidatesCount++;
        candidates[candidatesCount - 1] = Candidate(candidatesCount - 1, _name, 0);
        emit CandidateAdded(candidatesCount - 1, _name);
    }

    function registerIdentity(bytes32 identityHash) public onlyAdmin {
        require(!registeredVoters[identityHash], "already registered");
        registeredVoters[identityHash] = true;
        emit IdentityRegistered(identityHash);
    }

    function isRegistered(bytes32 identityHash) public view returns (bool) {
        return registeredVoters[identityHash];
    }

    function vote(uint _candidateId, bytes32 identityHash) public {
        require(registeredVoters[identityHash], "identity not registered");
        require(!hasVoted[identityHash], "already voted");
        require(_candidateId < candidatesCount, "invalid candidate");

        hasVoted[identityHash] = true;
        candidates[_candidateId].voteCount += 1;

        emit VoteRecorded(_candidateId, identityHash, msg.sender);
    }

    function getVoteCount(uint _candidateId) public view returns (uint) {
        return candidates[_candidateId].voteCount;
    }
}
