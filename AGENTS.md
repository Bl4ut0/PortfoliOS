# PortfoliOS Delivery Policy

For implementation requests in this repository, completion means the change is
validated, committed, pushed to GitHub, deployed to the configured production
server, and checked at the production URL.

## Default completion flow

1. Preserve unrelated user changes and stage only files belonging to the task.
2. Run the relevant automated checks.
3. Commit the completed task with a concise, descriptive message.
4. Push the active production branch to `origin`.
5. Run the repository's configured production deployment command. Publish
   referenced assets before the HTML entry point and use fresh cache versions
   for changed browser assets.
6. Verify the deployed site responds and contains the new release assets.
7. Report the commit, push, deployment, and production verification results.

Do not stop at "local and uncommitted" unless deployment is blocked by missing
credentials, a failed check, an unavailable server, or the user explicitly asks
for local-only work.

Never commit `.env`, credentials, deployment tokens, or unrelated worktree
changes.
