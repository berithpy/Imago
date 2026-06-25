import { useParams } from "react-router-dom";
import { AppShell } from "@/client/components/shell/AppShell";
import { AuthCheckBoundary, useAuthCheck } from "@/client/lib/authGate";

type PlaceholderProps = {
  title: string;
  blurb: string;
};

/**
 * Shared placeholder for the four sub-routes under `/:tenantSlug/manage/`.
 * Real implementations land in later phases (member management, branding
 * settings, billing, etc.). For now we just render a header + the
 * standard nav so the routes are reachable and the nav links work end
 * to end.
 *
 * Access control: redirects to the tenant login if no session, or to the
 * tenant dashboard if the actor lacks any membership on this tenant.
 */
function ManagePlaceholder({ title, blurb }: PlaceholderProps) {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const authCheck = useAuthCheck({
    role: "tenant-member",
    tenantSlug: tenantSlug ?? "",
    loginPath: `/${tenantSlug}/login`,
    returnTo: `/${tenantSlug}/manage`,
    unauthorizedTo: `/${tenantSlug}`,
  });

  return (
    <AuthCheckBoundary decision={authCheck}>
      <AppShell>
        <div className="max-w-[900px] mx-auto px-6 py-10">
          <h1 className="text-[1.75rem] font-bold mb-2">{title}</h1>
          <p className="text-neutral-500 text-sm mb-6">{blurb}</p>
          <div className="bg-neutral-900 border border-neutral-800 rounded-lg px-6 py-10 text-center">
            <p className="text-neutral-500 text-sm">Coming soon.</p>
          </div>
        </div>
      </AppShell>
    </AuthCheckBoundary>
  );
}

export function MembersPage() {
  return (
    <ManagePlaceholder
      title="Members"
      blurb="Invite collaborators and manage their roles."
    />
  );
}

export function SubscribersPage() {
  return (
    <ManagePlaceholder
      title="Subscribers"
      blurb="People who opted in to receive gallery updates."
    />
  );
}

export function UsagePage() {
  return (
    <ManagePlaceholder
      title="Usage"
      blurb="Storage, bandwidth, and image-transform quotas."
    />
  );
}

export function SettingsPage() {
  return (
    <ManagePlaceholder
      title="Settings"
      blurb="Branding, custom domain, and account preferences."
    />
  );
}

export function BillingPage() {
  return (
    <ManagePlaceholder
      title="Billing"
      blurb="Subscription, invoices, and payment methods."
    />
  );
}
