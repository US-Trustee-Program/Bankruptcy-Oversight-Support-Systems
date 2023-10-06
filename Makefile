
API_PATH=backend/functions
WEB_PATH=user-interface

clean-api:
	rm -rf $(API_PATH)/dist && rm -rf $(API_PATH)/coverage && rm -rf $(API_PATH)/node_modules

clean-web:
	rm -rf $(WEB_PATH)/build && rm -rf $(WEB_PATH)/coverage && rm -rf $(WEB_PATH)/node_modules

clean-all: clean-api clean-web

build-api:
	pushd $(API_PATH) && npm ci && npm run build && popd

build-web:
	pushd $(WEB_PATH) && npm ci && npm run build && popd

build-all: build-api build-web

depcruise-build-image:
	docker build ops/docker/depcruise -t depcruise

depcruise: depcruise-build-image
	docker run -v .:/repo depcruise
