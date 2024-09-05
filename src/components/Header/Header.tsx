"use client";
import { type FC } from "react";

import { Button, HStack, Heading } from "@chakra-ui/react";
import { Avatar } from "@coinbase/onchainkit/identity";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Red_Rose } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import { useAccount } from "wagmi";

import { useWindowSize } from "@/hooks/useWindowSize";

import EpheSafe from "../../../public/img/ephesafe.png";
import { DarkModeButton } from "../DarkModeButton";

const Header: FC = () => {
  let { address } = useAccount();
  const { isTablet } = useWindowSize();

  if (!address) {
    address = "0x0000000000000000000000000000000000000000"; // 0 zero address
  }

  return (
    <HStack
      as="header"
      p={"1.5rem"}
      position="sticky"
      top={0}
      zIndex={10}
      justifyContent={"space-between"}
    >
      <HStack>
        <Image src={EpheSafe.src} alt="logo" width={45} height={45} />
        {!isTablet && (
          <Link href={"/"}>
            <Heading as="h1" fontSize={"1.5rem"} className="text-shadow">
              EpheSafe
            </Heading>
          </Link>
        )}
      </HStack>

      <HStack>
        <Button colorScheme="green">
          <Link href="/my-safes-dashboard/my-safes"> Dashboard </Link>
        </Button>
        <ConnectButton />
        <Avatar address={address} />;
        <DarkModeButton />
      </HStack>
    </HStack>
  );
};

export default Header;
