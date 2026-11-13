# End-to-end flows (Maestro)

docs/spec/05-quality-delivery.md §12.6. These drive a real development build on an emulator or device.

| Flow | Needs | Covers |
|---|---|---|
| `01-sign-in-screens.yaml` | A development build only | Welcome, email validation, sending a code |
| `02-book-and-cancel.yaml` | Staging backend, a demo passenger account, emulator location inside a zone | Sign-in, location, vehicle, destination, quote, request, free cancel |

```bash
maestro test .maestro/01-sign-in-screens.yaml
```

```bash
maestro test -e EMAIL=<demo email> -e PASSWORD=<password> .maestro/02-book-and-cancel.yaml
```

Pass credentials with `-e` on the command line; never write them into these files.

Still to add once the backend allows it: complete a trip end to end (the driver side driven through the rider-admin
API), offline during request, and kill-and-reopen mid-trip.
