# Agentic Work Index

Canonical location for active agentic work items.

Human engineer comment: Not sure if we actually need this file, we could just use the working tree of the in-progress folder as the source

## In Progress
- [AW-001 Scheduled worker deletion pipeline](in-progress/AW-001-scheduled-worker-deletion-pipeline.md)
- [AW-002 Scheduled R2 orphan audit](in-progress/AW-002-scheduled-worker-r2-orphan-audit.md)
- [AW-003 Subscriber upload notifications](in-progress/AW-003-subscriber-upload-notifications.md)
- [AW-004 Email subscription confirmations](in-progress/AW-004-email-subscription-confirmations.md)
- [AW-005 Gallery expiry warning email](in-progress/AW-005-gallery-expiry-warning-email.md)
- [AW-006 Tenant plan limits enforcement](in-progress/AW-006-tenant-plan-limits-enforcement.md)
- [AW-007 Tenant usage dashboard](in-progress/AW-007-tenant-usage-dashboard.md)
- [AW-008 Storage reconciliation cron](in-progress/AW-008-storage-reconciliation-cron.md)
- [AW-009 Client photo rating v1](in-progress/AW-009-client-photo-rating-v1.md)
- [AW-010 Rating filters, export, and lightbox workflow](in-progress/AW-010-rating-filters-export-lightbox.md)
- [AW-011 Tenant admin invitation flow](in-progress/AW-011-tenant-admin-invitation-flow.md)
- [AW-012 Workers KV subscriber scaling option](in-progress/AW-012-workers-kv-subscriber-scaling.md)
- [AW-013 Centralized client API layer](in-progress/AW-013-centralized-client-api-layer.md)
- [AW-014 Tenant onboarding flow](in-progress/AW-014-tenant-onboarding-flow.md)
- [AW-015 Tenant gallery filter, tags, and pagination](in-progress/AW-015-tenant-gallery-filter-tags-pagination.md)
- [AW-016 Tenant dashboard stats and shell rework](in-progress/AW-016-tenant-dashboard-stats-shell-rework.md)
- [AW-017 Dev auth precheck for Wrangler](in-progress/AW-017-dev-auth-precheck-for-wrangler.md)
- [AW-018 Dashboard route guard without tenant or operator context](in-progress/AW-018-dashboard-route-guard-without-tenant-or-operator.md)
- [UI-001 Login card post-submit state](in-progress/UI-001-login-card-post-submit-state.md)
- [UI-002 Gallery list square thumbnail](in-progress/UI-002-gallery-list-square-thumbnail.md)
- [UI-003 Gallery management multiselect controls](in-progress/UI-003-gallery-management-multiselect-controls.md)
- [UI-004 Gallery management confirmation modal](in-progress/UI-004-gallery-management-confirmation-modal.md)
- [UI-005 Private toggle password completion flow](in-progress/UI-005-private-toggle-password-completion-flow.md)
- [UI-006 Unify async operation loading border treatment](in-progress/UI-006-unify-async-operation-loading-border.md)
- [UI-007 New gallery password handoff and share access copy flow](in-progress/UI-007-new-gallery-password-share-flow.md)
- [UI-008 Standardize auth-check no-flash loading behavior](in-progress/UI-008-reduce-gallery-view-loading-flash.md)

## Workflow
- Create one file per issue in docs/agentic/in-progress.
- Consider scope and create multiple files if tasks are independent
- Move files to future status folders later if needed.
- Keep root backlog docs as lightweight indexes only.

## Quick Checks
Use `rg` against ticket frontmatter when the index drifts from the files.

```powershell
# List every in-progress ticket title from frontmatter.
rg -n "^title: " "docs/agentic/in-progress"

# Check one ticket's title field.
rg -n "^title: " "docs/agentic/in-progress/UI-005-private-toggle-password-completion-flow.md"

# Check one ticket's full frontmatter block.
rg -n "^(id|title|status|source|area|priority|depends_on|updated): " "docs/agentic/in-progress/UI-005-private-toggle-password-completion-flow.md"

# List all tracked frontmatter fields for every in-progress ticket.
rg -n "^(id|title|status|source|area|priority|depends_on|updated): " "docs/agentic/in-progress"
```
