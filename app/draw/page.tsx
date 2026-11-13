import { redirect } from "next/navigation";

/** The random draw was replaced by the admin's team sheet; old links go to the fixtures. */
export default function DrawRedirect() {
  redirect("/matches");
}
