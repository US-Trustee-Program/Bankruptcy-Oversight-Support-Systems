# Hub pool slot-2 validation (throwaway)

Temporary marker for `cams-ugs9g`. This branch exists only to stand up a second
branch environment against the CAMS-760 SQL Private Link hub, so that three
never-executed paths can be observed against real Azure:

- address-pool slot advancement past slot 0
- Azure's own overlap-rejection acting as the pool's collision detector
- teardown, which deletes the hub-side peering and frees the slot

Not intended to merge. Delete this file and the branch once findings are
recorded on `cams-ugs9g`.
