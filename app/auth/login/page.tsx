import { Suspense } from "react";
import Nav from "@/components/nav";
import { Shell } from "@/components/ui";
import LoginForm from "./form";

export const metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <>
      <Nav />
      <Shell>
        <div className="max-w-sm mx-auto py-14">
          <h1 className="mb-1.5">Provider sign in</h1>
          <p className="text-charcoal-soft text-body mb-6">
            For people who list their work.
          </p>
          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>
        </div>
      </Shell>
    </>
  );
}
