import Nav from "@/components/nav";
import { Shell } from "@/components/ui";
import ForgotForm from "./form";

export const metadata = { title: "Reset your password" };

export default function ForgotPage() {
  return (
    <>
      <Nav />
      <Shell>
        <div className="max-w-sm mx-auto py-14">
          <h1 className="mb-1.5">Reset your password</h1>
          <p className="text-charcoal-soft text-body mb-7">
            We&rsquo;ll email you a link that lets you set a new one.
          </p>
          <ForgotForm />
        </div>
      </Shell>
    </>
  );
}
