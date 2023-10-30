import { useEffect, useState } from "react";
import { AddressZero } from "@ethersproject/constants";

import { MosaicStoreState } from "@mosaic/lib-base";
import { useMosaicSelector } from "@mosaic/lib-react";

import { useMosaic } from "../hooks/MosaicContext";

import { Dashboard } from "./Dashboard";
import { UnregisteredFrontend } from "./UnregisteredFrontend";
import { FrontendRegistration } from "./FrontendRegistration";
import { FrontendRegistrationSuccess } from "./FrontendRegistrationSuccess";

const selectFrontend = ({ frontend }: MosaicStoreState) => frontend;

export const PageSwitcher: React.FC = () => {
  const {
    account,
    config: { frontendTag }
  } = useMosaic();

  const frontend = useMosaicSelector(selectFrontend);
  const unregistered = frontendTag !== AddressZero && frontend.status === "unregistered";

  const [registering, setRegistering] = useState(false);

  useEffect(() => {
    if (unregistered) {
      setRegistering(true);
    }
  }, [unregistered]);

  if (registering || unregistered) {
    if (frontend.status === "registered") {
      return <FrontendRegistrationSuccess onDismiss={() => setRegistering(false)} />;
    } else if (account === frontendTag) {
      return <FrontendRegistration />;
    } else {
      return <UnregisteredFrontend />;
    }
  } else {
    return <Dashboard />;
  }
};
