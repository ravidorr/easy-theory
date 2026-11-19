# Security Policy

## Supported Versions

Security fixes are provided for the latest release only.

| Version                           | Supported |
| --------------------------------- | --------- |
| 0.59.4                            | ✓         |
| Earlier releases                  | ✘         |

## Reporting a Vulnerability

Do not report suspected vulnerabilities in public issues, discussions, or pull
requests.

Instead, use GitHub's private vulnerability reporting form from the
[repository Security tab](https://github.com/ravidorr/easy-theory/security)
and select **Report a vulnerability**.

Include:

- A description of the vulnerability and the affected version or component.
- Steps to reproduce it, including a proof of concept when available.
- The potential impact and any suggested mitigation.

We will acknowledge receipt within five business days and provide progress
updates at least weekly while we investigate. If we accept the report, we will
coordinate a fix and disclosure with you. If we decline it, we will explain
our reasoning.

## Data backups

The Supabase Free plan has no backups, so a daily workflow copies user and account data
into a private GitHub repository (`ravidorr/easy-theory-backups`, hosted in the United
States, access limited to the maintainer). The history of that repository is replaced when
it is older than 29 days, so a deleted account leaves the backups within about 30 days
while the daily run keeps succeeding. The backup repository, its deploy key and the
`database-backup` environment secrets should be included in the yearly access review.
Details and the restore procedure are in [docs/database-backups.md](docs/database-backups.md).
