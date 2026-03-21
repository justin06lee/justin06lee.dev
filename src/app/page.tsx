import { Suspense } from "react";
import HomeClient from "./home-client";
import { getSiteConfig } from "@/lib/site-config";

export const dynamic = "force-dynamic";

export default async function Page() {
  const config = await getSiteConfig();
  return (
    <Suspense fallback={null}>
      <HomeClient config={config} />
    </Suspense>
  );
}
