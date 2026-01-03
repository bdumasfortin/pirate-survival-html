# Known Issues

Track confirmed bugs and gameplay issues here.

- [ ] Day/Time is not synced between players at all
- [ ] Late join/rejoin desync: when a client joins after the room already started (or leaves and rejoins via "Leave room"), players appear but movement/positions are wrong and never reconcile. Happens for host and non-host, same client or new client. Repro is consistent on two local windows with localhost relay. Works only when all players were present at room creation.
