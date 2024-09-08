"use client";
import { useEffect, useState } from "react";

import { Box, Flex, Text, SimpleGrid, Button, Modal, ModalOverlay, ModalContent, ModalHeader, ModalFooter, ModalBody, ModalCloseButton, useDisclosure, Input, VStack, HStack } from "@chakra-ui/react";
import { ethers } from "ethers";
import { useAccount, useChainId } from "wagmi";

import { Footer, Header } from "@/components";
import LoadingScreen from "@/components/MainPane/components/LoadingScreen";
import { NftCard } from "@/components/NftCard";
import { SideBar } from "@/components/Sidebar";
import { ERC20ABI, EPHESAFE_ABI, EPHESAFE_CONTRACT_ADDRESS } from "@/config";
import { getDefaultEthersSigner } from "@/utils/clientToEtherjsSigner";
import { convertToUnixTimestamp, formatUnixTimestamp } from "@/utils/timeUtils";

export default function MySafes() {
  const account = useAccount();
  const chainId = useChainId();
  const epheSafeContractAddress = EPHESAFE_CONTRACT_ADDRESS[chainId];

  const [mySafes, setMySafes] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [selectedSafe, setSelectedSafe] = useState(null);
  const [emergencyUnlockAddress, setEmergencyUnlockAddress] = useState("");

  const getTokenData = async (tokenAddress) => {
    const signer = await getDefaultEthersSigner();
    let tokenContract = null;
    let tokenDecimals = null;
    let tokenSymbol = null;
    if (tokenAddress === "0x0000000000000000000000000000000000000000") {
      tokenDecimals = 18;
      tokenSymbol = "ETH";
    } else {
      tokenContract = new ethers.Contract(tokenAddress, ERC20ABI, signer);
      tokenDecimals = await tokenContract.decimals();
      tokenSymbol = await tokenContract.symbol();
    }
    return { tokenContract, tokenDecimals, tokenSymbol };
  };

  const fetchSafes = async () => {
    if (account.isConnecting) return;
    setIsLoading(true);
    const signer = await getDefaultEthersSigner();
    const epheSafeContract = new ethers.Contract(
      epheSafeContractAddress,
      EPHESAFE_ABI,
      signer
    );
    const safes = [];
    const mySafes = await epheSafeContract.getAllMultiSafeAuthorityTokens(account.address);
    console.log(mySafes);
    for (let i = 0; i < mySafes.length; i++) {
      const [safeInfo, tokenUri, unlockAddresses] = await epheSafeContract.getSafeInfo(mySafes[i]);
      const { tokenDecimals, tokenSymbol } = await getTokenData(safeInfo.tokenAddress);
      const safeMetadataRes = await fetch(
        tokenUri.replace("ipfs://", "https://gateway.lighthouse.storage/ipfs/")
      );
      const safeMetadata = await safeMetadataRes.json();

      const emergencyUnlockState = await epheSafeContract.emergencyUnlockState(mySafes[i]);

      if(safeInfo.status != "EMERGENCY_UNLOCKED"){
        const safeObject = {
          nftId: mySafes[i],
          amount: ethers.formatUnits(safeInfo.amount.toString(), tokenDecimals),
          tokenSymbol: tokenSymbol,
          expiry: formatUnixTimestamp(Number(safeInfo.expiry.toString())),
          status: safeInfo.status,
          metadata: safeMetadata,
          safeAddresses: safeInfo.multiSafeAddresses,
          noOfApprovalsRequired: safeInfo.noOfApprovalsRequired.toString(),
          emergencyUnlockState: {
            status: emergencyUnlockState.status,
            unlockAddresses: unlockAddresses,
            approvalCount: emergencyUnlockState.approvalCount.toString(),
          },
        };
        console.log(safeObject)
        safes.push(safeObject);
      }
    }
    setMySafes(safes);
   
    setIsLoading(false);
  };

  useEffect(() => {
    fetchSafes();
  }, [account.address]);

  const handleClaim = async (tokenId) => {
    setIsLoading(true);
    try {
      const signer = await getDefaultEthersSigner();
      const epheSafeContract = new ethers.Contract(
        epheSafeContractAddress,
        EPHESAFE_ABI,
        signer
      );
      const tx = await epheSafeContract.claimSafe(tokenId);
      await tx.wait();
      fetchSafes();
    } catch (error) {
      console.error("Error claiming safe:", error);
    }
    setIsLoading(false);
  };

  const handleEmergencyUnlock = (safe) => {
    setSelectedSafe(safe);
    onOpen();
  };

  const executeEmergencyUnlock = async (unlockAddress) => {
    setIsLoading(true);
    onClose();
    try {
      const signer = await getDefaultEthersSigner();
      const epheSafeContract = new ethers.Contract(
        epheSafeContractAddress,
        EPHESAFE_ABI,
        signer
      );
      const tx = await epheSafeContract.approveOrExecuteEmergencyUnlock(selectedSafe.nftId, emergencyUnlockAddress || unlockAddress);
      await tx.wait();
      fetchSafes();
    } catch (error) {
      console.error("Error executing emergency unlock:", error);
    }
    setIsLoading(false);
  };

  return (
    <Flex flexDirection="column" minHeight="100vh" bg="gray.50">
      <LoadingScreen isLoading={isLoading} />
      <Header />
      <Text align="center" fontSize="4xl" my={6} color="purple.700">
        My Safes
      </Text>
      <Flex>
        <SideBar />
        <Box as="main" flex={1} p={6} ml="250px">
          <SimpleGrid columns={{ sm: 1, md: 2, lg: 3 }} spacing={8}>
            {mySafes.map((safe) => (
              <NftCard
                key={safe.nftId}
                title={safe.metadata.name + " #" + safe.nftId}
                imageUrl={safe.metadata.image.replace(
                  "ipfs://",
                  "https://gateway.lighthouse.storage/ipfs/"
                )}
                description={safe.metadata.description}
                amount={`${safe.amount} ${safe.tokenSymbol}`}
                status={safe.status}
                expiry={safe.expiry}
                nftId={safe.nftId}
                approvals={safe.noOfApprovalsRequired}
                onClaim={() => handleClaim(safe.nftId)}
                onEmergencyUnlock={() => handleEmergencyUnlock(safe)}
                emergencyUnlockState={safe.emergencyUnlockState}
              />
            ))}
          </SimpleGrid>
        </Box>
      </Flex>
      <Modal isOpen={isOpen} onClose={onClose} size="xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Emergency Unlock</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4} align="stretch">
              <Text>Current Unlock Addresses and Approvals:</Text>
              {selectedSafe && selectedSafe?.emergencyUnlockState?.unlockAddresses && selectedSafe.emergencyUnlockState.unlockAddresses.map((address, index) => (
                <HStack key={index} justifyContent="space-between">
                  <Text>{address}</Text>
                  <Button
                    size="sm"
                    colorScheme="blue"
                    onClick={() => executeEmergencyUnlock(address)}
                  >
                    Approve
                  </Button>
                </HStack>
              ))}
              <Text>Or enter a new unlock address:</Text>
              <Input
                value={emergencyUnlockAddress}
                onChange={(e) => setEmergencyUnlockAddress(e.target.value)}
                placeholder="0x..."
              />
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button colorScheme="blue" mr={3} onClick={() => executeEmergencyUnlock(emergencyUnlockAddress)}>
              Approve and Execute
            </Button>
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
      <Footer />
    </Flex>
  );
}