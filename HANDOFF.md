# CryptoSage marketing website

## Current work

2026-10-30: Gold observatory design selected by the user; 17 real screenshot exports refreshed from the verified 1.3.14 (67) capture campaign. Fourteen refreshed assets are used on the page; remaining exports preserve hero asset continuity. Nine usable build-60 captures remain where newer capture attempts showed consent, empty, or locked states.

## Workflow

- No build step. The existing GitHub Pages deployment serves main at https://cryptosageai.io/. Preserve CNAME and .nojekyll.
- Imported Studio main working copy contains earlier uncommitted work. This change was developed in an isolated review worktree from origin/main; that work was not reset or mixed in.
- Source the Studio toolchain, then run `node tools/website_qa.mjs --browser chromium` and `--browser webkit`. Playwright comes from PLAYWRIGHT_MODULE; no package install is needed. Use --out to choose evidence location.
- Run the current no-build-marketing-site skill's `site_audit.py . --probe-links --json`.
- After deployment, run its `deployment_handoff_gate.py deployment-handoff-contract.json --root . --live --receipt-out <path> --pretty`. Preserve the emitted receipt hash separately.
- Social image source: tools/og-card.html. Run `node tools/render_og_card.mjs`; bump banner.jpg cache tokens in every public HTML page after changing it.

## Invariants

1. Screenshot controls are manual; exactly one hero frame is visible, including reduced-motion mode.
2. Scripts are progressive enhancements. Content, legal text, support links and default monthly prices remain available without JavaScript.
3. Optional newsletter failures cannot break navigation or hide content. QA must mock or block newsletter writes; never submit to production for routine tests.
4. Every screenshot replacement updates its alt text, cache token, hash and provenance. Demo holdings are labelled as examples.
5. Empty domain-association files intentionally grant no app routes. Native entitlements do not currently declare this domain, and no Android app is claimed.
6. Follow the original site's existing GitHub Pages hosting, not a second host/domain.

## Validation

Static audit including live outward links passed with zero failures and zero warnings. Chromium and WebKit passed 103 checks each; five focused final-delta checks per engine verified pending signup feedback, duplicate prevention, target sizing and large-text reflow. Final evidence is recorded with the deployment review. Direct hardware screen-reader testing and real-email delivery are outside this browser pass.
