import React from "react";
import { PortalAuth } from "@/components/PortalAuth";

export default function SignInScreen() {
  return <PortalAuth kind="customer" redirectTo="/account" />;
}
