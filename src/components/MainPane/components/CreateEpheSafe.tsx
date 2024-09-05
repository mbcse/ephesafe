import {
  type FC,
  type ChangeEvent,
  useEffect,
  useState,
  useCallback,
} from "react";

import { Box, Button, Center, Flex, HStack, Image, Input, Select, Spinner, Text, VStack, useToken } from "@chakra-ui/react";
import { getAttestations } from "@coinbase/onchainkit/identity";
import { TokenSearch, TokenSelectDropdown, getTokens } from "@coinbase/onchainkit/token";
import type { Token } from "@coinbase/onchainkit/token";
import axios from "axios";
import { ethers } from "ethers";
import { debounce } from 'lodash';
import { baseSepolia } from "viem/chains";
import { useAccount, useChainId, useReadContract, useWriteContract } from "wagmi";

import { EPHESAFE_CONTRACT_ADDRESS, EPHESAFE_ABI, ERC20ABI } from "@/config";
import { useSignMessageHook, useNotify } from "@/hooks";
import type { ContractAddress } from "@/types";
import { getDefaultEthersSigner, getEthersSigner } from "@/utils/clientToEtherjsSigner";
import { uploadFile, uploadJson, urlToFile } from "@/utils/ipfsHelper";
import { createMetaData } from "@/utils/nftHelpers";
import { convertToUnixTimestamp } from "@/utils/timeUtils";

import LoadingScreen from "./LoadingScreen";

const CreateEpheSafe: FC = () => {
  const account = useAccount();
  const chainId = useChainId();
  const epheSafeContractAddress = EPHESAFE_CONTRACT_ADDRESS[chainId];
  const [safeName, setSafeName] = useState("");
  const [safeValue, setSafeValue] = useState("");
  const [safeExpiry, setSafeExpiry] = useState("");
  const [safeDescription, setSafeDescription] = useState("");
  const [safeImage, setSafeImage] = useState<FileList | null | unknown>(null);
  const [safeToken, setSafeToken] = useState("");
  const [safeAddresses, setSafeAddresses] = useState("");
  const [noOfApprovalsRequired, setNoOfApprovalsRequired] = useState("");
  const [tokenSymbol, setTokenSymbol] = useState("");

  const [imagePromt, setImagePromt] = useState("");
  const [imagePromtUrl, setImagePromtUrl] = useState("");
  const [fetchingImage, setFetchingImage] = useState(false);

  const [selectTokenList, setSelectTokenList] = useState([
    {
      name: "ETH",
      address: "0x0000000000000000000000000000000000000000",
      symbol: "ETH",
      decimals: 18,
      image: "",
      chainId: 31,
    },
    {
      name: "USDC",
      address: "0xa9ad1484d9bfb27adbc2bf50a6e495777cc8cff2",
      symbol: "USDC",
      decimals: 18,
      image:
        "https://s2.coinmarketcap.com/static/img/coins/200x200/3408.png",
      chainId: 31,
    }
  ]);

  const [selectSafeToken, setSelectSafeToken] = useState("");

  const [isLoading, setIsLoading] = useState(false);

  const getTokenData = async () => {
    const signer = await getDefaultEthersSigner();
    let tokenContract = null;
    let tokenDecimals = null;
    let tokenSymbol = null;
    if (safeToken === "0x0000000000000000000000000000000000000000") {
      tokenDecimals = 18;
      tokenSymbol = "ETH";
    } else {
      tokenContract = new ethers.Contract(safeToken, ERC20ABI, signer);
      tokenDecimals = await tokenContract.decimals();
      tokenSymbol = await tokenContract.symbol();
    }

    return { tokenContract, tokenDecimals, tokenSymbol };
  };

  useEffect(() => {
    if (selectSafeToken) {
      setSafeToken(selectSafeToken.address);
    }
  }, [selectSafeToken]);

  useEffect(() => {
    const fetchTokenData = async () => {
      try {
        if (safeToken) {
          const tokenData = await getTokenData();
          const checkList = selectTokenList.filter((token) => {
            return token.address === safeToken;
          });

          if (checkList.length === 0) {
            console.log("Token Not Found");
            setSelectTokenList([
              ...selectTokenList,
              {
                name: tokenData.tokenSymbol,
                address: safeToken,
                symbol: tokenData.tokenSymbol,
                decimals: tokenData.tokenDecimals,
                image: "",
                chainId: chainId,
              },
            ]);

            setSelectSafeToken({
              name: tokenData.tokenSymbol,
              address: safeToken,
              symbol: tokenData.tokenSymbol,
              decimals: tokenData.tokenDecimals,
              image: "",
              chainId: chainId,
            });
          }
        }
      } catch (error) {
        console.log(error);
      }
    };
    fetchTokenData();
  }, [safeToken]);

  const { notifyError, notifySuccess } = useNotify();

  const createImage = async (imagePromtPassed?: string) => {
    setFetchingImage(true);
    const options = {
      method: "POST",
      url: "/api/corcel",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        Authorization: "3ff413ba-70e0-4e3b-9de4-ec02b21525e1",
      },
      data: {
        imagePromt: imagePromtPassed || imagePromt,
      },
    };

    const response = await axios.request(options);
    console.log(response.data);
    setImagePromtUrl(response.data[0].image_url);
    console.log(imagePromtUrl);
    const file = await urlToFile(response.data[0].image_url, "nft-img", "png");
    setSafeImage(file);
    setFetchingImage(false);
    return response.data;
  };

  const debouncedFetchResults = useCallback(debounce((promt) => createImage(promt), 5000), []);

  useEffect(() => {
    setFetchingImage(true)
  }, [imagePromt])

  const handlePromtChange = (e: any) => {
    const { value } = e.target;
    setImagePromt(value);
    console.log(imagePromt)
    debouncedFetchResults(value);
  };

  const createSafe = async () => {
    setIsLoading(true);
    const signer = await getDefaultEthersSigner();
    const epheSafeContract = new ethers.Contract(
      epheSafeContractAddress,
      EPHESAFE_ABI,
      signer
    );
    try {
      const { tokenContract, tokenDecimals } = await getTokenData();
      const safeAmountInUnits = ethers.parseUnits(safeValue, tokenDecimals);

      if (tokenContract) {
        const currentAllowance = await tokenContract.allowance(
          account.address,
          EPHESAFE_CONTRACT_ADDRESS[chainId],
        );
        if (currentAllowance < safeAmountInUnits) {
          const tx = await tokenContract.approve(
            epheSafeContractAddress,
            safeAmountInUnits,
          );
          await tx.wait();
        }
      }

      const safeImageHash = await uploadFile(safeImage);
      console.log(safeImageHash);
      const metadata = createMetaData(
        safeImageHash,
        safeDescription,
        "EpheSafe",
        safeExpiry,
        {},
      );
      const metadataHash = await uploadJson(metadata);
      console.log(metadataHash);

      const safeAddressesArray = safeAddresses.split(",").map(addr => addr.trim());

      const tx = await epheSafeContract.mintSafe(
        account.address,
        metadataHash,
        convertToUnixTimestamp(safeExpiry),
        safeAmountInUnits,
        safeToken,
        safeAddressesArray,
        safeDescription,
        Number(noOfApprovalsRequired),
        { value: tokenContract ? 0 : safeAmountInUnits },
      );
      console.log(tx);
      await tx.wait();
      notifySuccess({
        title: "Success",
        message: "Safe created successfully TxHash: " + tx.hash,
      });
    } catch (error: any | ethers.BytesLike) {
      console.log(error);
      if (error.data)
        console.log(epheSafeContract.interface.parseError(ethers.getBytes(error.data)));
      notifyError({ title: "Error", message: "Error creating safe, please try again later" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Flex w={"100%"} display={"flex"} justifyContent={"center"} alignContent={"center"} flexWrap={"wrap"} gap={0}>
        {imagePromtUrl && (
          <Box boxSize="sm" className="ml-4">
            {fetchingImage ? (
              <Center
                top="0"
                left="0"
                width="100%"
                height="100%"
                bg="rgba(0, 0, 0, 0.5)"
              >
                <Spinner size="xl" />
                <Text marginLeft={2}>Fetching Image using AI</Text>
              </Center>
            ) : (
              <Image src={URL.createObjectURL(safeImage[0] as any)} alt="Selected Image" boxSize="100%" objectFit="cover" />
            )}
          </Box>
        )}
        <Flex direction="column" align="start" w="100%">
          <Text fontSize="md" fontWeight="medium">Select Safe Image</Text>
          <Text fontSize="sm" color="gray.500" mb={2}>Choose one of the following options to set an image for your Safe.</Text>
          <VStack spacing={4} w="100%">
            <Box w="100%">
              <Text fontSize="sm" color="gray.600">Input an AI prompt:</Text>
              <Input
                placeholder="Enter AI prompt"
                value={imagePromt}
                onChange={(e) => handlePromtChange(e)}
                mb={2}
              />
              OR
            </Box>
            <Box w="100%">
              <Text fontSize="sm" color="gray.600">Upload an image from your computer:</Text>
              <Input
                type="file"
                onChange={(e) => setSafeImage(e.target.files)}
                mb={2}
              />
            </Box>
          </VStack>
        </Flex>
      </Flex>
 
      <Flex w={"100%"} display={"flex"} justifyContent={"space-around"} flexWrap={"wrap"} gap={5}>
        <LoadingScreen isLoading={isLoading} />

        <VStack w={"45%"} minWidth={"270px"} gap={2}>
          <Text textAlign="left" fontWeight="bold">
            Safe Name
          </Text>
          <Input
            value={safeName}
            onChange={(e) => setSafeName(e.target.value)}
            type="text"
            placeholder="Enter Safe Name"
          />
        </VStack>

        <VStack w={"45%"} minWidth={"270px"} gap={2} textAlign="left">
          <Text textAlign="left" fontWeight="bold">
            Safe Value
          </Text>
          <Input
            value={safeValue}
            onChange={(e) => setSafeValue(e.target.value)}
            type="text"
            placeholder="Safe Value"
          />
        </VStack>

        <VStack w={"45%"} minWidth={"270px"} gap={2} textAlign="left">
          <Text textAlign="left" fontWeight="bold">
            Token Address for Safe
          </Text>
          <Flex>
            <TokenSelectDropdown
              token={selectSafeToken}
              setToken={setSelectSafeToken}
              options={selectTokenList}
            />
            <Input
              value={safeToken}
              onChange={(e) => setSafeToken(e.target.value)}
              type="text"
            />
          </Flex>
        </VStack>

        <VStack w={"45%"} minWidth={"270px"} gap={2} textAlign="left">
          <Text textAlign="left" fontWeight="bold">
            Safe Description
          </Text>
          <Input
            value={safeDescription}
            onChange={(e) => setSafeDescription(e.target.value)}
            type="text"
            placeholder="Safe Description"
          />
        </VStack>

        <VStack w={"45%"} minWidth={"270px"} gap={2} textAlign="left">
          <Text textAlign="left" fontWeight="bold">
            Safe Expiry
          </Text>
          <Input
            value={safeExpiry}
            onChange={(e) => {
              setSafeExpiry(e.target.value);
            }}
            type="datetime-local"
          />
        </VStack>

        <VStack w={"45%"} minWidth={"270px"} gap={2} textAlign="left">
          <Text textAlign="left" fontWeight="bold">
            Safe Addresses
          </Text>
          <Input
            value={safeAddresses}
            onChange={(e) => setSafeAddresses(e.target.value)}
            type="text"
            placeholder="Comma-separated addresses for multi-signature"
          />
        </VStack>

        <VStack w={"45%"} minWidth={"270px"} gap={2} textAlign="left">
          <Text textAlign="left" fontWeight="bold">
            Number of Approvals Required
          </Text>
          <Input
            value={noOfApprovalsRequired}
            onChange={(e) => setNoOfApprovalsRequired(e.target.value)}
            type="number"
            placeholder="Number of approvals required for emergency unlock"
          />
        </VStack>

        <VStack w={"100%"} minWidth={"270px"} gap={2} textAlign="left">
          <Button
            colorScheme="teal"
            variant="solid"
            onClick={() => {
              createSafe();
            }}
            isLoading={isLoading}
            className="custom-button"
          >
            Create a Safe
          </Button>
        </VStack>
      </Flex>
    </>
  );
};

export default CreateEpheSafe;