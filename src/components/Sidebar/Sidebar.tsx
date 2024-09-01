import { Box, VStack, Link, Text, Icon } from "@chakra-ui/react";
import NextLink from "next/link";
import { FaCookieBite, FaPlusCircle } from "react-icons/fa";

const Sidebar: React.FC = () => {
  return (
    <Box
      as="nav"
      position="fixed"
      left={0}
      top={0}
      bottom={0}
      width="250px"
      bgGradient="linear(to-b, purple.600, purple.800)"
      color="white"
      padding="20px"
    >
      <VStack align="start" spacing={6} mt="100px">
        <NextLink href="/my-safes-dashboard/my-safes" passHref>
          <Link
            display="flex"
            alignItems="center"
            _hover={{ textDecoration: "none", color: "yellow.300" }}
          >
            <Icon as={FaCookieBite} mr={3} />
            <Text fontSize="lg" fontWeight="bold">
              My Safes
            </Text>
          </Link>
        </NextLink>
        <NextLink href="/my-safes-dashboard/my-secondary-safes" passHref>
          <Link
            display="flex"
            alignItems="center"
            _hover={{ textDecoration: "none", color: "yellow.300" }}
          >
            <Icon as={FaPlusCircle} mr={3} />
            <Text fontSize="lg" fontWeight="bold">
              My Secondary Safes
            </Text>
          </Link>
        </NextLink>
      </VStack>
    </Box>
  );
};

export default Sidebar;
