# Content review manifests

`release.json` is the only approval input to a content release. It begins as a
draft deliberately: do not mark it approved until every active question and
sign has Hebrew and Arabic review records.

Run `pnpm content:verify` for structural validation. Run
`pnpm content:verify --publish` before promotion; it rejects missing approvals,
missing sign assets, uncited explanations, duplicate records, and unpinned
sources.

Run `pnpm content:validate-questions` to independently validate the Ministry
private-car subset, answer markers, topics, manifest source hash, and images.

Create the sign snapshot with:

```sh
pnpm content:import-signs --revision 43643480 --output .context/wikipedia-signs.json
```

The command exits nonzero for duplicate, missing, or unclassified Wikipedia
entries; a reviewer must resolve each item in the generated release data before
approval.

For promotion, load the reviewed rows with their `source_release_id` values in
one database transaction, then call:

```sql
SELECT public.publish_content_release('<question-release-uuid>', '<sign-release-uuid>');
```

The function activates only those two releases and expires open exam sessions.
