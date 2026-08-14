#!/bin/sh
set -eu

awslocal s3api create-bucket --bucket "${FILES_S3_BUCKET:-app-files}" >/dev/null 2>&1 || true
