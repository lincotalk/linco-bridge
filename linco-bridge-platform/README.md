# Linco Bridge

Linco Bridge is organized around two main deliverables:

- `linco-bridge-connect`: the local desktop connector that runs on a user's PC and bridges local Agent CLIs.
- `linco-bridge-platform`: the self-hosted open platform example, including web frontend, backend service, and built-in gateway.

The backend gateway is intentionally kept inside `linco-bridge-platform/server` so users can deploy the platform quickly without operating an extra gateway service.

## Layout

```text
linco-bridge/
  linco-bridge-connect/
  linco-bridge-platform/
    web/
    server/
    deploy/
  docs/
    plans/
```

