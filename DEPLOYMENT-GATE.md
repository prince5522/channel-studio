# Supervised release checklist

- [ ] Lead reviewed algorithm, API validation, logging, and security before merge.
- [ ] Automated test workflow passed on the pull request.
- [ ] Deploy this branch to a staging-only API environment; do not point the public app at it yet.
- [ ] Run the `Staging validation gate` workflow with the staging base URL.
- [ ] Verify all three generated language samples pass and the returned source text reconstructs byte-for-byte at the Unicode string level.
- [ ] Review audit events for autonomous episode count, every selected cut, and each generated title; ensure no manuscript body text appears in logs.
- [ ] Lead reviewed staging results and approved production release.
- [ ] Production environment requires reviewer approval and is not deployable before the staging gate is green.

The repository cannot truthfully mark staging as passed until a staging deployment exists and the workflow completes successfully.
