import { redirect } from "next/navigation";

/** Pick 7 now lives on My Team (accounts + weekly carry-over). */
export default function PickRedirect() {
  redirect("/team");
}
