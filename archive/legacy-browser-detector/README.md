# Retired browser detector

RiichiCam no longer runs a detector in the browser. The production application sends scans to
the authenticated private inference service and receives only tile predictions.

The former browser detector is preserved in Git history rather than duplicated in this working
tree. This archive intentionally contains no model weights, export metadata, runtime binaries,
or runnable fallback path.
