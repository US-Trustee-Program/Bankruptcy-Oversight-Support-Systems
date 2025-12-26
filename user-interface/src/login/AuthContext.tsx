import OktaAuth from "@okta/okta-auth-js";
import { createContext } from "react";

export type AuthContextValue = {oktaAuth?: OktaAuth};
export const AuthContext = createContext({} as AuthContextValue);