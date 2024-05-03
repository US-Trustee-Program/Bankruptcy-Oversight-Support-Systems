#!/bin/bash

PORT_NUMBER=8080
IMAGE_REPO=quay.io/keycloak/keycloak
IMAGE_TAG=24.0.4
CONTAINER_NAME=cams_sso

# pragma: allowlist secret
ADMIN_U="admin"
ADMIN_P="admin"


function get_image_fqn {
    if [ "$IMAGE_TAG" == "" ]; then echo $IMAGE_REPO; else echo $IMAGE_REPO:$IMAGE_TAG; fi
}

function is_initialized {
    if [ "$(docker ps -a -q -f name="$CONTAINER_NAME")" ]; then return 0; else return 255; fi
}

function is_started {
    if [ "$(docker ps -q -f name="$CONTAINER_NAME")" ]; then return 0; else return 255; fi
}

function initialize {
    docker run -v ./sso:/opt/keycloak/data/import --name $CONTAINER_NAME -d -p $PORT_NUMBER:8080 -e KEYCLOAK_ADMIN=$ADMIN_U -e KEYCLOAK_ADMIN_PASSWORD=$ADMIN_P "$(get_image_fqn)" start-dev --import-realm
}

function start {
    if ! is_initialized; then initialize; fi
    if ! is_started; then docker start $CONTAINER_NAME; fi
    echo ""
    echo "WebCloak Admin"
    echo "http://localhost:$PORT_NUMBER/admin/master/console/"
    echo ""
    echo "Username: $ADMIN_U"
    echo "Password: $ADMIN_P"
}

function stop {
    if is_started; then docker stop $CONTAINER_NAME; fi
}

function status {
    echo ""
    echo "Status: Initialized? $(is_initialized && echo YES || echo NO); Started? $(is_started && echo YES || echo NO)"
}

function uninstall {
    if is_started; then stop; fi
    if is_initialized; then docker container rm $CONTAINER_NAME; fi
    if docker images | grep -q $IMAGE_REPO | grep -q $IMAGE_TAG; then docker rmi "$(get_image_fqn)"; fi
}

function help {
    echo ""
    echo "Usage:"
    echo ""
    echo "$0 start     - start the server container"
    echo "$0 stop      - stop the server container"
    echo ""
    echo "$0 uninstall - remove the container and image"
    echo ""
    echo "$0 help      - this usage guide"
}

function run_command {
    case $1 in
        uninstall|start|stop|status)
        $1
        ;;

        *)
        help
        ;;
    esac
}

function docker_not_installed {
    echo "docker not installed"
}


if [[ $(which docker) == "" ]]; then
    docker_not_installed
else
    run_command "$1"
fi
