import { redirect } from "next/navigation";

/** API keys moved to the Endpoint & Key home page. */
export default function KeysRedirect() {
  redirect("/");
}
