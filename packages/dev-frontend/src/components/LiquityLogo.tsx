import React from "react";
import { Box, Image } from "theme-ui";

type MosaicLogoProps = React.ComponentProps<typeof Box> & {
  height?: number | string;
};

export const MosaicLogo: React.FC<MosaicLogoProps> = ({ height, ...boxProps }) => (
  <Box sx={{ lineHeight: 0 }} {...boxProps}>
    <Image src="./msic-icon.png" sx={{ height }} />
  </Box>
);
