import Nav from "@/components/nav";
import { Shell } from "@/components/ui";
import ResetForm from "./form";

export const metadata = { title: "Set a new password" };

export default function ResetPage() {
  return (
    <>
      <Nav />
      <Shell>
        <div className="max-w-sm mx-auto py-14">
          <h1 className="mb-1.5">Set a new password</h1>
          <p className="text-charcoal-soft text-body mb-7">
            Choose something you will remember. You stay signed in afterwards.
          </p>
          <ResetForm />
        </div>
      </Shell>
    </>
  );
}
