import Link from "next/link";
import { CreateShopForm } from "@/components/CreateShopForm";
import { SiteLegalFooter } from "@/components/SiteLegalFooter";

export default function CreateShopPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-4 py-16">
      <h1 className="text-2xl font-semibold text-zinc-50">Create Shop</h1>

      <CreateShopForm />

      <p className="mt-8 text-center text-sm text-zinc-500">
        Already have a shop?{" "}
        <Link href="/dashboard/login" className="text-blue-400 hover:underline">
          Sign in
        </Link>
      </p>
      <p className="mt-4 text-center">
        <Link href="/" className="text-sm text-zinc-600 hover:text-zinc-400">
          ← Home
        </Link>
      </p>

      <SiteLegalFooter />
    </main>
  );
}
