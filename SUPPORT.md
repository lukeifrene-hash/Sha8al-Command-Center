# Support

Use the public docs and templates to route the issue to the right surface.

## Before You Open An Issue

1. Read [README.md](README.md) for the public bootstrap flow.
2. Run `npm run tracker:guard:status` to confirm the resolved profile, project root, and tracker path.
3. Run the validation commands that match your problem:
   - `npm run check:validation`
   - `npm run check:publish-readiness`
4. Read [docs/troubleshooting.md](docs/troubleshooting.md) for common setup and profile-resolution failures.

## Where To File What

- Product bug or broken behavior: use the bug report issue template.
- Compatibility regression for TalkStore: use the profile compatibility issue template.
- Missing or confusing docs: use the documentation issue template.
- Security issue: do not open a public issue. Follow [SECURITY.md](SECURITY.md).

## Compatibility Note

`sha8al-command-center` is the public platform identity.
TalkStore remains a supported compatibility profile, so compatibility bugs should say whether the problem only affects the `talkstore` path or also affects the public `generic` path.
