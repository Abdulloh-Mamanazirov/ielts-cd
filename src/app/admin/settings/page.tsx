import { AdminPage } from "@/components/admin/AdminPage";
import { AuthSettingsEditor } from "@/components/admin/AuthSettingsEditor";
import { MarkingSettingsEditor } from "@/components/admin/MarkingSettingsEditor";
import { MockSettingsEditor } from "@/components/admin/MockSettingsEditor";
import { loadAuthSettings } from "@/lib/auth-settings-store";
import { loadMarkingSettings } from "@/lib/marking-settings-store";
import { loadMockSettings } from "@/lib/mock-settings-store";

export const metadata = { title: "Settings · Admin" };
export const dynamic = "force-dynamic";

/** Site-wide switches that are not about a plan or a test. */
export default async function SettingsAdminPage() {
  const [auth, marking, mock] = await Promise.all([
    loadAuthSettings(),
    loadMarkingSettings(),
    loadMockSettings(),
  ]);

  return (
    <AdminPage
      eyebrow="SETTINGS"
      title="Site settings"
      subtitle="Switches that change how the public site behaves. They take effect immediately."
    >
      <div className="space-y-5">
        <AuthSettingsEditor initial={auth} />
        <MarkingSettingsEditor initial={marking} />
        <MockSettingsEditor initial={mock} />
      </div>
    </AdminPage>
  );
}
