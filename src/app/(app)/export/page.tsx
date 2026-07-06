import { redirect } from "next/navigation";

// Der Export lebt jetzt im Tab „Steuererklärung"
export default function ExportPage() {
  redirect("/steuererklaerung");
}
