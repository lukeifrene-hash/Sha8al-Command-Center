# Sha8al Command Center Troubleshooting

## Bootstrap wrote the wrong project root

- Re-run `npm run bootstrap -- --project /absolute/path/to/project`.
- Use `--output-env-file /tmp/command-center.env` if you want to inspect the generated config before replacing `.env`.
- Run `npm run tracker:guard:status` to confirm the resolved project root, profile, and tracker path.

## Bootstrap is running against an empty repo

- For the public `generic` profile, bootstrap now scaffolds starter versions of:
  - `docs/roadmap.md`
  - `docs/manifesto.md`
- Replace the starter roadmap tasks with your real milestone plan before serious build work.

## The parser is targeting the wrong tracker file

- Check `COMMAND_CENTER_TRACKER_FILE` in `.env`.
- Run `npm run tracker:guard:status`.
- For public installs, the expected default is `command-center-tracker.json`.
- For TalkStore compatibility installs, `talkstore-tracker.json` remains valid and may be preferred when it already exists.

## The parser fails with a parser/profile mismatch

- In `scripts/parse-markdown.mjs`, `--profile` means parser profile, not consumer profile.
- The markdown parser supports both `generic` and `talkstore` parser profiles. Use the package aliases instead of swapping flags manually.
- For public installs, keep `COMMAND_CENTER_PROFILE=generic` and use the public alias names unchanged.
- Use the public parser alias for public installs: `npm run tracker:parse:project-tasks`.
- Use the compatibility aliases only when you intentionally want the TalkStore compatibility wrapper names: `npm run tracker:parse:talkstore-tasks` and `npm run tracker:parse:talkstore-roadmap`.
- ACI flows remain explicit: `npm run tracker:parse:aci-roadmap` and `npm run tracker:seed:aci`.
- If a public tracker was created before the generic parser cleanup, rerun `npm run tracker:parse:project-tasks:dry-run` and then `npm run tracker:parse:project-tasks` to restamp it with `generic-markdown:generic`.

## Script writes are blocked

If `tracker:guard:status` resolves the live sibling TalkStore tracker, script-side writes are blocked by default.

- Dry-run first.
- Only set `COMMAND_CENTER_ALLOW_TRACKER_WRITES=true` when you intentionally want a compatibility write.
- Do not use that override for a fresh external project.

## The example project does not work

- Run `npm run bootstrap -- --project /absolute/path/to/this-repo/examples/minimal-command-center-project`.
- Confirm `examples/minimal-command-center-project/docs/roadmap.md` exists. Public generic installs require that file.
- Run `npm run tracker:guard:status`.
- Run `npm run tracker:parse:project-tasks:dry-run`.
- Confirm the dry-run output includes `Parser/source pairing: generic-markdown:generic`.
- If that succeeds, run `npm run tracker:parse:project-tasks`.

## CLI naming is confusing

- `sha8al-command-center` is the public CLI alias.
- `talkstore` is the compatibility alias.
- During the transition window, both names can coexist without implying that TalkStore is the platform identity.
