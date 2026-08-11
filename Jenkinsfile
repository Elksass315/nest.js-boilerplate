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
                            echo "Deployment failed; rolling back to $previous_image"
                            APP_IMAGE="$previous_image" APP_ENV_FILE="$env_file" \
                                docker compose --env-file "$env_file" \
                                -f "$deploy_path/compose.yaml" \
                                -f "$deploy_path/compose.deploy.yaml" \
                                up --detach --no-build --wait api postgres redis
                        fi
                        exit "$exit_code"
                    }
                    trap rollback EXIT

                    export APP_IMAGE="$IMAGE_REF"
                    export APP_ENV_FILE="$env_file"

                    docker compose --env-file "$env_file" \
                        -f "$deploy_path/compose.yaml" \
                        -f "$deploy_path/compose.deploy.yaml" \
                        pull api migrate

                    docker compose --env-file "$env_file" \
                        -f "$deploy_path/compose.yaml" \
                        -f "$deploy_path/compose.deploy.yaml" \
                        run --rm migrate

                    docker compose --env-file "$env_file" \
                        -f "$deploy_path/compose.yaml" \
                        -f "$deploy_path/compose.deploy.yaml" \
                        up --detach --no-build --wait api postgres redis

                    api_port="$(grep -E '^API_HOST_PORT=' "$env_file" | tail -n 1 | cut -d= -f2 || true)"
                    api_port="${api_port:-3000}"
                    curl --fail --silent --show-error \
                        --retry 5 --retry-delay 2 \
                        "http://127.0.0.1:${api_port}/health/ready"

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
