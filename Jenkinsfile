pipeline {
    agent { label 'docker-deploy' }

    options {
        disableConcurrentBuilds()
        timestamps()
        timeout(time: 20, unit: 'MINUTES')
    }

    parameters {
        string(name: 'IMAGE_REF', defaultValue: '', description: 'Immutable GHCR image reference including @sha256 digest')
        choice(name: 'TARGET_ENV', choices: ['development', 'staging', 'production'], description: 'Deployment environment')
        string(name: 'SOURCE_BRANCH', defaultValue: '', description: 'Protected source branch that produced the image')
        string(name: 'SOURCE_COMMIT', defaultValue: '', description: 'Git commit that produced the image')
        string(name: 'BACKUP_REFERENCE', defaultValue: '', description: 'Managed database backup/PITR reference captured before production migrations')
    }

    environment {
        DEPLOY_ROOT = '/srv/nestjs-saas'
    }

    stages {
        stage('Validate immutable release') {
            steps {
                sh '''
                    set -eu
                    printf '%s' "$IMAGE_REF" | grep -Eq '^ghcr\.io/.+@sha256:[a-f0-9]{64}$'
                    printf '%s' "$SOURCE_COMMIT" | grep -Eq '^[a-f0-9]{40}$'

                    case "$TARGET_ENV:$SOURCE_BRANCH" in
                        development:develop) ;;
                        staging:release/*) ;;
                        production:main) ;;
                        *) echo "Branch $SOURCE_BRANCH cannot deploy to $TARGET_ENV" >&2; exit 1 ;;
                    esac

                    if test "$TARGET_ENV" = production && test -z "$BACKUP_REFERENCE"; then
                        echo 'BACKUP_REFERENCE is required before production migrations' >&2
                        exit 1
                    fi

                    docker --version
                    docker compose version
                '''
            }
        }

        stage('Production approval') {
            when {
                expression { params.TARGET_ENV == 'production' }
            }
            input {
                message 'Deploy this immutable image to production?'
                ok 'Deploy'
                submitterParameter 'APPROVED_BY'
            }
            steps {
                echo "Production deployment approved by ${APPROVED_BY}"
            }
        }

        stage('Deploy') {
            steps {
                sh '''
                    set -eu

                    deploy_path="$DEPLOY_ROOT/$TARGET_ENV"
                    env_file="$deploy_path/.env"
                    state_file="$deploy_path/.deployed-image"
                    deployment_record="$deploy_path/.deployment-record"
                    previous_image=""

                    test -f "$env_file"
                    install -d -m 0750 "$deploy_path"
                    install -m 0644 compose.yaml "$deploy_path/compose.yaml"
                    install -m 0644 compose.deploy.yaml "$deploy_path/compose.deploy.yaml"

                    if test -f "$state_file"; then
                        previous_image="$(cat "$state_file")"
                    fi

                    rollback() {
                        exit_code=$?
                        if test "$exit_code" -ne 0 && test -n "$previous_image"; then
                            previous_compatibility="$(docker image inspect --format '{{ index .Config.Labels \"org.opencontainers.image.migration-compatibility\" }}' "$previous_image" 2>/dev/null || true)"
                            if test -z "$previous_compatibility" || test "$previous_compatibility" = '<no value>'; then
                                echo "Rollback refused: previous image $previous_image has no migration compatibility declaration" >&2
                            else
                                echo "Deployment failed; rolling back to $previous_image"
                                APP_IMAGE="$previous_image" APP_ENV_FILE="$env_file" \
                                    docker compose --env-file "$env_file" \
                                    -f "$deploy_path/compose.yaml" \
                                    -f "$deploy_path/compose.deploy.yaml" \
                                    up --detach --no-build --wait api mail-worker file-worker outbox-worker
                            fi
                        fi
                        exit "$exit_code"
                    }
                    trap rollback EXIT

                    export APP_IMAGE="$IMAGE_REF"
                    export APP_ENV_FILE="$env_file"

                    docker compose --env-file "$env_file" \
                        -f "$deploy_path/compose.yaml" \
                        -f "$deploy_path/compose.deploy.yaml" \
                        pull api mail-worker file-worker outbox-worker migrate seed

                    migration_compatibility="$(docker image inspect --format '{{ index .Config.Labels \"org.opencontainers.image.migration-compatibility\" }}' "$IMAGE_REF" 2>/dev/null || true)"
                    if test -z "$migration_compatibility" || test "$migration_compatibility" = '<no value>'; then
                        echo "Image $IMAGE_REF has no migration compatibility declaration" >&2
                        exit 1
                    fi

                    docker compose --env-file "$env_file" \
                        -f "$deploy_path/compose.yaml" \
                        -f "$deploy_path/compose.deploy.yaml" \
                        run --rm migrate

                    docker compose --env-file "$env_file" \
                        -f "$deploy_path/compose.yaml" \
                        -f "$deploy_path/compose.deploy.yaml" \
                        run --rm seed

                    docker compose --env-file "$env_file" \
                        -f "$deploy_path/compose.yaml" \
                        -f "$deploy_path/compose.deploy.yaml" \
                        up --detach --no-build --wait api mail-worker file-worker outbox-worker

                    api_port="$(grep -E '^API_HOST_PORT=' "$env_file" | tail -n 1 | cut -d= -f2 || true)"
                    api_port="${api_port:-3000}"
                    curl --fail --silent --show-error \
                        --retry 5 --retry-delay 2 \
                        "http://127.0.0.1:${api_port}/health/ready"

                    docker compose --env-file "$env_file" \
                        -f "$deploy_path/compose.yaml" \
                        -f "$deploy_path/compose.deploy.yaml" \
                        exec -T api node -e 'const Redis=require("ioredis"); const client=new Redis({host:process.env.REDIS_HOST,port:Number(process.env.REDIS_PORT),password:process.env.REDIS_PASSWORD||undefined,db:Number(process.env.REDIS_DB||0),connectTimeout:3000}); client.ping().then((value)=>{if(value!=="PONG")process.exit(1);}).catch(()=>process.exit(1)).finally(()=>client.disconnect());'

                    docker compose --env-file "$env_file" \
                        -f "$deploy_path/compose.yaml" \
                        -f "$deploy_path/compose.deploy.yaml" \
                        exec -T mail-worker node -e 'const net=require("node:net"); const socket=net.createConnection({host:process.env.MAIL_SMTP_HOST,port:Number(process.env.MAIL_SMTP_PORT)},()=>{socket.end(); process.exit(0);}); socket.setTimeout(3000,()=>{socket.destroy();process.exit(1);}); socket.on("error",()=>process.exit(1));'

                    docker compose --env-file "$env_file" \
                        -f "$deploy_path/compose.yaml" \
                        -f "$deploy_path/compose.deploy.yaml" \
                        exec -T file-worker node -e 'const {S3Client,HeadBucketCommand}=require("@aws-sdk/client-s3"); const client=new S3Client({region:process.env.FILES_S3_REGION,endpoint:process.env.FILES_S3_ENDPOINT,forcePathStyle:process.env.FILES_S3_FORCE_PATH_STYLE==="true",credentials:process.env.FILES_S3_ACCESS_KEY_ID?{accessKeyId:process.env.FILES_S3_ACCESS_KEY_ID,secretAccessKey:process.env.FILES_S3_SECRET_ACCESS_KEY}:undefined}); client.send(new HeadBucketCommand({Bucket:process.env.FILES_S3_BUCKET})).then(()=>process.exit(0)).catch(()=>process.exit(1));'

                    {
                        printf 'image=%s\n' "$IMAGE_REF"
                        printf 'source_commit=%s\n' "$SOURCE_COMMIT"
                        printf 'migration_compatibility=%s\n' "$migration_compatibility"
                        printf 'backup_reference=%s\n' "${BACKUP_REFERENCE:-not-required}"
                        printf 'deployed_at=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
                    } > "$deployment_record"
                    chmod 0640 "$deployment_record"

                    printf '%s\n' "$IMAGE_REF" > "$state_file"
                    chmod 0640 "$state_file"
                    trap - EXIT
                '''
            }
        }
    }

    post {
        success {
            echo "Deployed ${params.IMAGE_REF} to ${params.TARGET_ENV}"
        }
        failure {
            echo "Deployment failed; inspect the deployment and rollback logs above."
        }
    }
}
