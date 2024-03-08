
API_PATH=backend/functions
WEB_PATH=user-interface
COMMON_PATH=common

default:
	cat Makefile

clean-common:
	rm -rf $(COMMON_PATH)/build && rm -rf $(COMMON_PATH)/coverage && rm -rf $(COMMON_PATH)/node_modules

clean-api:
	rm -rf $(API_PATH)/dist && rm -rf $(API_PATH)/coverage && rm -rf $(API_PATH)/node_modules

clean-web:
	rm -rf $(WEB_PATH)/build && rm -rf $(WEB_PATH)/coverage && rm -rf $(WEB_PATH)/node_modules

clean-all: clean-common clean-api clean-web

build-common:
	pushd $(COMMON_PATH) && npm ci && npm run build && popd

build-api:
	pushd $(API_PATH) && npm ci && npm run build && popd

build-web:
	pushd $(WEB_PATH) && npm ci && npm run build && popd

build-all: build-common build-api build-web

depcruise-build-image:
	docker build ops/docker/depcruise -t depcruise

depcruise: depcruise-build-image
	docker run -v .:/repo depcruise
