// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts ^5.0.0
pragma solidity ^0.8.19;
pragma abicoder v2;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721EnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721BurnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

import "@openzeppelin/contracts/interfaces/IERC20.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

contract EpheSafe is Initializable, ERC721Upgradeable, ERC721EnumerableUpgradeable, ERC721PausableUpgradeable, AccessControlUpgradeable, ERC721BurnableUpgradeable, UUPSUpgradeable {
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    uint256 public _nextTokenId;

    enum SafeStatus {
        NONE,
        ACTIVE,
        EMERGENCY_UNLOCKED,
        BURN_CLAIMED
    }

    struct SafeInfo {
        uint256 expiry;
        uint256 amount;
        address tokenAddress;
        SafeStatus status;
        address[] multiSafeAddresses;
        string safeMetadata;
        uint256 noOfApprovalsRequired;
    }


    enum EmergencyUnlockStatus {
        NONE,
        ACTIVE,
        COMPLETED,
        STUCK
    }


    struct EmergencyUnlockState {
        EmergencyUnlockStatus status;
        address[] unlockAddresses;
        mapping(address => uint256) unlockAddressApprovalCount;
        mapping(address => bool) approvals;
        uint256 approvalCount;
    }

    mapping(uint256 => string) private _tokenURIs;

    mapping(uint256 => SafeInfo) public safeInfo;
    mapping(uint256 => EmergencyUnlockState) public emergencyUnlockState;

    uint256 public totalClaimedSafes;
    uint256 public totalBurntSafes;

    mapping(address => uint256[]) public safeIssuers;
    mapping(address => uint256[]) public multiSafeAuthorizers;


    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _owner, address minter)
        initializer public
    {
        __ERC721_init("EpheSafe", "EPS");
        __ERC721Enumerable_init();
        __ERC721Pausable_init();
        __AccessControl_init();
        __ERC721Burnable_init();
        __UUPSUpgradeable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, _owner);
        _grantRole(UPGRADER_ROLE, _owner);
        _grantRole(MINTER_ROLE, minter);
    }

    function pause() public onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() public onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    event SafeMinted(address indexed from, address indexed to, uint256 tokenId, uint256 indexed expiry, uint256 safeAmount, address safeTokenAddress, string safeMetadata);
    event SafeClaimed(address indexed claimAddress, uint256 tokenId, uint256 safeAmount, address safeTokenAddress, string safeMetadata);
    event SafeDestroyed(address indexed destroyer, uint256 indexed tokenId, uint256 safeAmount, address safeTokenAddress, uint256 destroyReward);
    event MetadataUpdate(uint256 _tokenId);
    error InsufficientMsgValue(uint256 requiredValue,  uint256 passedValue);
    event EmergencyUnlockApproved(address indexed approver, uint256 tokenId);
    event EmergencyUnlockExecuted(address indexed executor, uint256 tokenId, uint256 safeAmount, address safeTokenAddress, address recipient);

    function mintSafe(address to, string memory uri, uint256 expiry,
    uint256 safeAmount, address safeTokenAddress,
    address[] memory safeAddresses, string memory safeMetadata, uint256 noOfApprovalsRequired) public payable {
        require(expiry > block.timestamp, "EpheSafe: expiry must be in the future");

        if(safeTokenAddress != address(0)) {
            IERC20 token = IERC20(safeTokenAddress);
            token.transferFrom(msg.sender, address(this), safeAmount);
        }else{
            if(msg.value < safeAmount) {
                revert InsufficientMsgValue(safeAmount, msg.value);
            }
        }
        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);

        safeInfo[tokenId] = SafeInfo(expiry, safeAmount, safeTokenAddress, SafeStatus.ACTIVE, safeAddresses, safeMetadata, noOfApprovalsRequired);
        safeInfo[tokenId].multiSafeAddresses.push(msg.sender);
        _setTokenURI(tokenId, uri);

        safeIssuers[msg.sender].push(tokenId);

        for(uint i = 0; i < safeAddresses.length; i++){
            multiSafeAuthorizers[safeInfo[tokenId].multiSafeAddresses[i]].push(tokenId);
        }

        emit SafeMinted(msg.sender, to, tokenId, expiry, safeAmount, safeTokenAddress, safeMetadata);

    }

    function claimSafe(uint256 tokenId) public {
        require(safeInfo[tokenId].expiry < block.timestamp, "Safe: Not Yet Expired");
        require(safeInfo[tokenId].status == SafeStatus.ACTIVE, "TokenSafe: safe already claimed or expired");
        safeInfo[tokenId].status = SafeStatus.BURN_CLAIMED;
        address _safeOwner = ownerOf(tokenId);
        if(safeInfo[tokenId].tokenAddress != address(0)) {
            IERC20 token = IERC20(safeInfo[tokenId].tokenAddress);
            token.transfer(_safeOwner, safeInfo[tokenId].amount);
        }else{
            payable(_safeOwner).transfer(safeInfo[tokenId].amount);
        }
        _burn(tokenId);
        totalClaimedSafes += 1;

        emit SafeClaimed(_safeOwner, tokenId, safeInfo[tokenId].amount, safeInfo[tokenId].tokenAddress, safeInfo[tokenId].safeMetadata);
    }

    function claimSafeAtAddress(uint256 tokenId, address claimAddress) public {
        require(ownerOf(tokenId) == msg.sender, "TokenSafe: Not Owner");
        require(safeInfo[tokenId].expiry < block.timestamp, "Safe: Not Expired");
        require(safeInfo[tokenId].status == SafeStatus.ACTIVE, "TokenSafe: Safe already claimed or expired");
        safeInfo[tokenId].status = SafeStatus.BURN_CLAIMED;
        if(safeInfo[tokenId].tokenAddress != address(0)) {
            IERC20 token = IERC20(safeInfo[tokenId].tokenAddress);
            token.transfer(claimAddress, safeInfo[tokenId].amount);
        }else{
            payable(claimAddress).transfer(safeInfo[tokenId].amount);
        }
        _burn(tokenId);
        totalClaimedSafes += 1;
        emit SafeClaimed(claimAddress, tokenId, safeInfo[tokenId].amount, safeInfo[tokenId].tokenAddress, safeInfo[tokenId].safeMetadata);
    }

    // function burnSafe(uint256 tokenId) public {
    //     require( block.timestamp > safeInfo[tokenId].expiry, "TokenSafe: safe not expired");
    //     require(safeInfo[tokenId].status == SafeStatus.ACTIVE, "TokenSafe: safe already claimed or expired");
    //     safeInfo[tokenId].status = SafeStatus.EXPIRED_REFUNDED;

    //     uint256 burnReward = calculateBurnRewardFee(safeInfo[tokenId].amount);
    //     totalBurnRewardFeeDistributed += burnReward;

    //     uint256 refundAmount = safeInfo[tokenId].amount - burnReward;

    //     if(safeInfo[tokenId].tokenAddress != address(0)) {
    //         IERC20 token = IERC20(safeInfo[tokenId].tokenAddress);
    //         token.transfer(safeInfo[tokenId].refundTreasury, refundAmount);
    //         // Send burn reward to msg.sender
    //         token.transfer(msg.sender, burnReward);
    //     }else{
    //         payable(safeInfo[tokenId].refundTreasury).transfer(refundAmount);
    //         // Send burn reward to msg.sender
    //         payable(msg.sender).transfer(burnReward);
    //     }

    //     safeInfo[tokenId].transferable = true;
    //     _burn(tokenId);
    //     safeInfo[tokenId].transferable = false;

    //     totalBurntSafes += 1;
    //     emit SafeDestroyed(msg.sender, tokenId, safeInfo[tokenId].amount, safeInfo[tokenId].tokenAddress, burnReward);
    // }


    function getAllSafes() public view returns (uint256[] memory) {
        uint256 total = totalSupply();
        uint256[] memory tokens = new uint256[](total);
        for (uint256 i = 0; i < total; i++) {
            tokens[i] = tokenByIndex(i);
        }
        return tokens;
    }

    function getAllSafesOfOwner(address owner) public view returns (uint256[] memory) {
        uint256 balance = balanceOf(owner);
        uint256[] memory tokens = new uint256[](balance);
        for (uint256 i = 0; i < balance; i++) {
            tokens[i] = tokenOfOwnerByIndex(owner, i);
        }
        return tokens;
    }

    function getAllMultiSafeAuthorityTokens(address owner) public view returns (uint256[] memory) {
        return multiSafeAuthorizers[owner];
    }

    function getSafeInfo(uint256 tokenId) public view returns (SafeInfo memory safeData, string memory tokenUri, address[] memory unlockAddresses) {
        return (safeInfo[tokenId], tokenURI(tokenId), emergencyUnlockState[tokenId].unlockAddresses);
    }

    function getIssuedSafes(address issuer) public view returns (uint256[] memory) {
        return safeIssuers[issuer];
    }

    function updateTokenUri(uint256 tokenId, string memory uri) public {
        _setTokenURI(tokenId, uri);
    }

    function updateTokenIssuer(address issuer, uint256 tokenId) public {
        safeIssuers[issuer].push(tokenId);
    }

    function addMultiSafeAuthorizer(address authorizer, uint256 tokenId) public {
        multiSafeAuthorizers[authorizer].push(tokenId);
    }

    function _authorizeUpgrade(address newImplementation)
        internal
        onlyRole(UPGRADER_ROLE)
        override
    {}

    function ownerOf(uint256 tokenId) public view override(IERC721, ERC721Upgradeable) returns (address) {
        return _ownerOf(tokenId);
    }

    /**
     * @dev See {IERC721Metadata-tokenURI}.
     */
    function tokenURI(uint256 tokenId) public view virtual override returns (string memory) {

        string memory _tokenURI = _tokenURIs[tokenId];
        string memory base = _baseURI();

        // If there is no base URI, return the token URI.
        if (bytes(base).length == 0) {
            return _tokenURI;
        }
        // If both are set, concatenate the baseURI and tokenURI (via string.concat).
        if (bytes(_tokenURI).length > 0) {
            return string.concat(base, _tokenURI);
        }

        return super.tokenURI(tokenId);
    }

    /**
     * @dev Sets `_tokenURI` as the tokenURI of `tokenId`.
     *
     * Emits {MetadataUpdate}.
     */
    function _setTokenURI(uint256 tokenId, string memory _tokenURI) internal virtual {
        _tokenURIs[tokenId] = _tokenURI;
        emit MetadataUpdate(tokenId);
    }


    function approveOrExecuteEmergencyUnlock(uint256 tokenId, address recipient) public {
        SafeInfo storage info = safeInfo[tokenId];
        EmergencyUnlockState storage state = emergencyUnlockState[tokenId];
        require(state.status != EmergencyUnlockStatus.COMPLETED, "EpheSafe: Unlock Already Completed");
        require(info.status == SafeStatus.ACTIVE, "EpheSafe: Safe is not active");
        require(isSafeAddress(tokenId, msg.sender), "EpheSafe: Not authorized for emergency unlock");
        require(!state.approvals[msg.sender], "EpheSafe: Already approved");
        require(recipient!= address(0), "EpheSafe: Invalid recipient address");

        if(state.status == EmergencyUnlockStatus.NONE){
            state.status = EmergencyUnlockStatus.ACTIVE;
        }
        state.approvals[msg.sender] = true;
        state.approvalCount++;

        if(state.unlockAddressApprovalCount[recipient] == 0){
            state.unlockAddresses.push(recipient);
        }
        state.unlockAddressApprovalCount[recipient]+= 1;

        emit EmergencyUnlockApproved(msg.sender, tokenId);

        if(state.approvalCount >= info.noOfApprovalsRequired){
            for(uint i=0; i<state.unlockAddresses.length; i++){
                if(state.unlockAddressApprovalCount[state.unlockAddresses[i]] >= info.noOfApprovalsRequired){
                    executeEmergencyUnlock(tokenId, recipient);
                    break;
                }
            }
        }

        // Stuck Logic Pending

    }

    function executeEmergencyUnlock(uint256 tokenId, address recipient) internal {
        SafeInfo storage info = safeInfo[tokenId];
        require(recipient != address(0), "EpheSafe: Invalid recipient address");

        info.status = SafeStatus.EMERGENCY_UNLOCKED;

        if (info.tokenAddress != address(0)) {
            IERC20 token = IERC20(info.tokenAddress);
            token.transfer(recipient, info.amount);
        } else {
            payable(recipient).transfer(info.amount);
        }

        _burn(tokenId);
        emit EmergencyUnlockExecuted(msg.sender, tokenId, info.amount, info.tokenAddress, recipient);
    }

    function isSafeAddress(uint256 tokenId, address account) internal view returns (bool) {
        address[] memory addresses = safeInfo[tokenId].multiSafeAddresses;
        for (uint256 i = 0; i < addresses.length; i++) {
            if (addresses[i] == account) {
                return true;
            }
        }
        return false;
    }

    // The following functions are overrides required by Solidity.

    function _update(address to, uint256 tokenId, address auth)
        internal
        override(ERC721Upgradeable, ERC721EnumerableUpgradeable, ERC721PausableUpgradeable)
        returns (address)
    {
        // Check if token is transferable
        if(safeInfo[tokenId].expiry > block.timestamp) {
            revert("TokenSafe: Safe NFT not transferable");
        }
        return super._update(to, tokenId, auth);
    }

    function _increaseBalance(address account, uint128 value)
        internal
        override(ERC721Upgradeable, ERC721EnumerableUpgradeable)
    {
        super._increaseBalance(account, value);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721Upgradeable, ERC721EnumerableUpgradeable, AccessControlUpgradeable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
