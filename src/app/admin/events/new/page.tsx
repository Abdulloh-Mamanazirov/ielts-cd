import { AdminPage } from "@/components/admin/AdminPage";
import { EventForm } from "@/components/admin/EventForm";
import { eventTestOptions } from "@/lib/events/admin";

export const metadata = { title: "New event · Admin" };
export const dynamic = "force-dynamic";

export default async function NewEventPage() {
  const tests = await eventTestOptions();

  return (
    <AdminPage
      eyebrow="EVENTS"
      title="New mock test event"
      subtitle="It starts as a draft. Open it when you are ready to share the link."
    >
      <EventForm
        initial={{
          title: "",
          description: "",
          listeningTestId: "",
          readingTestId: "",
          writingTestId: "",
          closesAt: "",
          maxParticipants: null,
        }}
        tests={tests}
      />
    </AdminPage>
  );
}
