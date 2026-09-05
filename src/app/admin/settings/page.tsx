import { AdminPage } from "@/components/admin/AdminPage";
import { AuthSettingsEditor } from "@/components/admin/AuthSettingsEditor";
import { loadAuthSettings } from "@/lib/auth-settings-store";

export const metadata = { title: "Settings · Admin" };
export const dynamic = "force-dynamic";

/** Site-wide switches that are not about a plan or a test. */
export default async function SettingsAdminPage() {
  const auth = await loadAuthSettings();

  return (
    <AdminPage
      eyebrow="SETTINGS"
      title="Site settings"
      subtitle="Switches that change how the public site behaves. They take effect immediately."
    >
      <AuthSettingsEditor initial={auth} />
    </AdminPage>
  );
}
