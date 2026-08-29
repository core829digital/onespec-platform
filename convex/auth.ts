import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";
import { ResendOTP } from "./ResendOTP";
import { ResendPasswordReset } from "./ResendPasswordReset";

export const { auth, signIn, signOut, store } = convexAuth({
  providers: [
    Password({
      verify: ResendOTP,
      reset: ResendPasswordReset,
    }),
  ],
});