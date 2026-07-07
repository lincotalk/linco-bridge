# Security and Privacy

[简体中文](zh-CN/security-and-privacy.md)

## Before connecting real data

- Use a dedicated test credential for initial verification.
- Never commit App Secrets, tokens, or private keys.
- Review which local files and tools the selected agent can access.

## Data visibility

The table below describes the default behavior of the open-source connector and reference platform in this repository. Third-party deployments, custom adapters, or hosted products may differ.

| Data | Leaves computer | Visible to server | Stored | Retention | Deletion |
| --- | --- | --- | --- | --- | --- |
| Device metadata | Yes, when the connector announces online status and device identity to a compatible backend | Yes | Reference platform keeps current online-state metadata in memory by default | Until the connector disconnects or the server restarts | Stop the connector, disconnect the session, or restart the reference platform |
| Session index | May leave the computer when a compatible flow synchronizes session identifiers, titles, or previews | Yes, for synchronized fields | May be stored by the compatible backend or client flow in use; the reference platform also keeps linked session records in SQLite | Until deleted from the backend datastore or replaced by newer sync state | Delete the relevant session records from the backend datastore or reset the deployment data |
| Message content | Yes, when messages are relayed between client and local agent | Yes | The reference platform stores relayed chat messages in SQLite; connector-side local logs may also contain limited message-related diagnostics depending on configuration | Until deleted from the backend datastore or local runtime data | Delete message records from backend storage and local runtime data where applicable |
| Files | Yes, when users upload attachments or when the connector returns generated files through the bridge flow | Yes, in transit through the compatible backend or client | The reference platform does not persist uploaded/generated file payloads by default, but files may remain on the local machine, in client caches, or in third-party systems | Depends on the local filesystem, client caches, and deployment-specific storage | Delete local files, clear client caches, and remove deployment-specific stored copies if any |
| Diagnostic logs | Usually limited metadata and errors may leave the computer when logs are shared manually or when operators collect server logs | Possibly, depending on where logs are collected | Connector logs are local; reference-platform logs are process logs of the running deployment | Depends on local log rotation and deployment log policy | Remove local log files, runtime data, or deployment log retention outputs as applicable |

Do not claim end-to-end encryption, zero knowledge, or fully local processing unless implemented and reviewed for the exact flow in use.
