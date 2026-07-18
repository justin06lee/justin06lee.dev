import { isAdminServer } from "@/lib/auth-server";
import { OperatorCreateArticleForm } from "../OperatorCreateArticleForm";

export default async function DeskNewArticlePage() {
  // Consistent with the other desk pages: don't render the operator UI to
  // unauthenticated requests (the layout shows the login form).
  if (!(await isAdminServer())) return null;
  return (
    <main className="mx-auto max-w-5xl px-4 sm:px-6 pb-16">
      <OperatorCreateArticleForm />
    </main>
  );
}
