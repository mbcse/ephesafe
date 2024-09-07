import { useRef, useState } from "react";

import {
  Box,
  Image,
  Text,
  VStack,
  Flex,
  Button,
  useDisclosure,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
  Input,
  HStack,
  Center,
} from "@chakra-ui/react";
import { keyframes } from "@emotion/react";

const rotate = keyframes`
  0% { transform: rotateY(0deg); }
  50% { transform: rotateY(180deg); }
  100% { transform: rotateY(0deg); }
`;

const NftCard = ({ 
  title, 
  imageUrl, 
  description, 
  amount, 
  status, 
  expiry, 
  nftId, 
  approvals,
  onClaim,
  onEmergencyUnlock,
  emergencyUnlockState
}) => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const cancelRef = useRef();

  const handleClaim = () => {
    onClaim(nftId);
    onClose();
  };

  const EMERGENCY_UNLOCK_STATUS = [
    "NONE",
    "ACTIVE",
    "COMPLETED",
    "STUCK"
  ]

  const handleEmergencyUnlock = () => {
    onEmergencyUnlock();
  };

  const renderActionButton = () => {
    if (status === "BURN_CLAIMED") {
      return <Text color="green.500">CLAIMED</Text>;
    } else if (status === "EMERGENCY_UNLOCKED") {
      return <Text color="orange.500">EMERGENCY UNLOCKED</Text>;
    } else if (new Date(expiry) < new Date()) {
      return (
        <>
        <Button colorScheme="teal" onClick={onOpen}>
          CLAIM
        </Button>
        {
          emergencyUnlockState.status == 0 ? (
            <Button colorScheme="yellow" onClick={handleEmergencyUnlock}>
              Emergency Unlock
            </Button>
          ): (
            <Button colorScheme="orange" onClick={handleEmergencyUnlock}>
              APPROVE EMERGENCY UNLOCK
            </Button>
          )
        }
        </>
      );
    }else {
      return (
        <>
        {
          emergencyUnlockState.status == 0 ? (
            <>
            <Button colorScheme="red" onClick={handleEmergencyUnlock}>
              I AM HACKED
            </Button>
            <Button colorScheme="yellow" onClick={handleEmergencyUnlock}>
            Emergency Unlock
           </Button>
            </>
          ): (
            <Button colorScheme="orange" onClick={handleEmergencyUnlock}>
              APPROVE EMERGENCY UNLOCK
            </Button>
          )
        }
        </>
      );
    }
  };

  return (
    <>
      <Box
        bg="white"
        maxW="sm"
        borderWidth="1px"
        borderRadius="lg"
        overflow="hidden"
        boxShadow="xl"
        transition="transform 0.3s"
        _hover={{
          transform: "scale(1.05) rotateY(0deg)",
          boxShadow: "2xl",
          animationPlayState: "paused",
        }}
        // animation={`${rotate} 10s infinite`}
        transformStyle="preserve-3d"
        mb={8}
      >
        <Image
          src={imageUrl}
          alt={title}
          borderRadius="lg"
          objectFit="cover"
          w="100%"
          height="200px"
        />
        <VStack p="6" spacing="4" align="start">
          <Text fontWeight="bold" fontSize="2xl" color="purple.600">
            {title}
          </Text>
          <Text>{description}</Text>
          <Text fontWeight="bold" color="purple.500">
            {amount}
          </Text>
          <VStack w="100%" ml={0} fontSize="x-small" alignItems={"Center"}>
            {renderActionButton()}
          </VStack>
          <Text>Expiry: {expiry}</Text>
          <Text>Approvals Required: {approvals}</Text>
          {emergencyUnlockState.status != 0 && (
            <VStack align="start" w="100%">
              <Text fontWeight="bold">Emergency Unlock Status:</Text>
              <Text>{EMERGENCY_UNLOCK_STATUS[emergencyUnlockState.status]}</Text>
              <Text>Approvals: {emergencyUnlockState.approvalCount} / {approvals}</Text>
            </VStack>
          )}
        </VStack>
      </Box>

      <AlertDialog isOpen={isOpen} leastDestructiveRef={cancelRef} onClose={onClose}>
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Claim Safe
            </AlertDialogHeader>

            <AlertDialogBody>
              Are you sure you want to claim this safe?
            </AlertDialogBody>

            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={onClose}>
                Cancel
              </Button>
              <Button colorScheme="teal" onClick={handleClaim} ml={3}>
                Claim
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </>
  );
};

export default NftCard;