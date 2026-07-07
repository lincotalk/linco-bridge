# CLI Reference

[简体中文](zh-CN/cli.md)

> The backend owner must replace this draft with output verified from the final CLI `--help`.

| Command | Purpose |
| --- | --- |
| `linco-connect init` | Initialize credentials, agent type, channel, and account. |
| `linco-connect start --daemon` | Start the local bridge in the background. |
| `linco-connect stop` | Stop the local bridge. |
| `linco-connect status` | Show version and connection state, if implemented. |

Device identity is generated at runtime. Override the display name with `LINCO_DEVICE_NAME` or `device.name` in config when needed.

Never print the complete App Secret or token in normal output or logs. Document configuration paths, environment overrides, exit codes, upgrade, and uninstall behavior before release.

