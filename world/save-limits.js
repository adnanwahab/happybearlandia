// Full 10,000-person cities can outgrow 32 MiB after a few simulated days.
// Keep one consistent bounded limit across capture, client requests and SQLite.
export const COMPLETE_SAVE_MAX_BYTES=64*1024*1024;
