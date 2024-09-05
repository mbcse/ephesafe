export const createMetaData = (
  imageUri: string,
  description: string,
  treatType: string,
  expiry: string,
  additionaAttributes: any,
) => {
  return {
    description: description,
    external_url: "https://EpheSafe.xyz",
    image: imageUri,
    name: "EpheSafe",
    background_color: "000000",
    attributes: [
      {
        trait_type: "issuer",
        value: "EpheSafe",
      },
      {
        trait_type: "safe_type",
        value: treatType,
      },
      {
        trait_type: "safe_expiry",
        value: expiry,
      },
    ],
  };
};
