'use strict';

let runtimePromise;

exports.loadTusRuntime = function loadTusRuntime() {
  runtimePromise ??= Promise.all([
    import('@tus/server'),
    import('@tus/file-store'),
    import('@tus/s3-store'),
  ]).then(([server, fileStore, s3Store]) => ({
    Server: server.Server,
    FileStore: fileStore.FileStore,
    S3Store: s3Store.S3Store,
  }));
  return runtimePromise;
};
