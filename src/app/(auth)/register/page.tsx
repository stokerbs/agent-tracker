import { redirect } from "next/navigation";

// Registration is now handled by the OTP login flow.
// New users are automatically created on first successful OTP verification.
export default function RegisterPage() {
  redirect("/login");
}
