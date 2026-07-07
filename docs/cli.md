# CLI Reference

[简体中文](zh-CN/cli.md)

| Command | Purpose |
| --- | --- |
| `linco-connect init` | Initialize credentials, agent type, account, channel, and connection overrides. |
| `linco-connect remove-account` | Remove a configured account for an agent. |
| `linco-connect delete-account` | Alias of `remove-account`. |
| `linco-connect ws-prefix` | Write or clear `wsUrl` overrides for configured accounts in the selected channel. |
| `linco-connect start` | Start the local bridge in the foreground. |
| `linco-connect start --daemon` | Start the local bridge in the background. |
| `linco-connect stop` | Stop the local bridge. |
| `linco-connect reload` | Reload runtime configuration without manually restarting the process where supported. |
| `linco-connect status` | Show version and runtime status. |
| `linco-connect doctor` | Check local environment, CLI availability, and bridge-related configuration. |
| `linco-connect help` | Show help information. |
| `linco-connect version` | Print the installed version. |

## Notes

Device identity is generated at runtime. Override the display name with `LINCO_DEVICE_NAME` or `device.name` in config when needed.

- Never print the complete App Secret or token in normal output or logs.
- Runtime behavior may differ by agent type, configured channel, and local operating environment.
- For configuration structure, environment variables, and agent-specific notes, refer to [`linco-bridge-connect/README.md`](../linco-bridge-connect/README.md).
