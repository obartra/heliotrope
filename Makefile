.PHONY: dev dev-stop emulators cypress cypress-open check doctor

# PIDs for background processes
_PIDS_DIR := /tmp/heliotrope-dev-pids

# ── Development ──────────────────────────────────────────────

## Start emulators + Vite dev server in the background
dev:
	@mkdir -p $(_PIDS_DIR)
	@if [ -f $(_PIDS_DIR)/emulators.pid ] && kill -0 $$(cat $(_PIDS_DIR)/emulators.pid) 2>/dev/null; then \
		echo "emulators already running"; \
	else \
		echo "starting emulators..."; \
		pnpm emulators > /tmp/heliotrope-emulators.log 2>&1 & echo $$! > $(_PIDS_DIR)/emulators.pid; \
	fi
	@if [ -f $(_PIDS_DIR)/vite.pid ] && kill -0 $$(cat $(_PIDS_DIR)/vite.pid) 2>/dev/null; then \
		echo "vite already running"; \
	else \
		echo "starting vite..."; \
		pnpm dev > /tmp/heliotrope-vite.log 2>&1 & echo $$! > $(_PIDS_DIR)/vite.pid; \
	fi
	@echo "waiting for services..."
	@for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do \
		curl -s http://127.0.0.1:5173 > /dev/null 2>&1 && \
		curl -s http://127.0.0.1:8080 > /dev/null 2>&1 && \
		break; \
		sleep 1; \
	done
	@echo "ready: vite http://localhost:5173  emulators http://localhost:4000"

## Stop background dev processes
dev-stop:
	@if [ -f $(_PIDS_DIR)/vite.pid ]; then \
		kill $$(cat $(_PIDS_DIR)/vite.pid) 2>/dev/null; rm $(_PIDS_DIR)/vite.pid; echo "vite stopped"; \
	fi
	@if [ -f $(_PIDS_DIR)/emulators.pid ]; then \
		kill $$(cat $(_PIDS_DIR)/emulators.pid) 2>/dev/null; rm $(_PIDS_DIR)/emulators.pid; echo "emulators stopped"; \
	fi
	@# Clean up any leftover Java emulator processes
	@lsof -ti:8080,9099,9199 2>/dev/null | xargs kill 2>/dev/null || true

# ── Testing ──────────────────────────────────────────────────

## Run Cypress E2E tests (starts services if needed, leaves them running)
cypress: dev
	pnpm cypress

## Open Cypress interactive runner
cypress-open: dev
	pnpm cypress:open

# ── CI-style checks ─────────────────────────────────────────

## Run typecheck + lint + test + build
check:
	pnpm typecheck
	pnpm lint
	firebase emulators:exec "pnpm test" --only firestore,storage
	pnpm build

# ── Environment ─────────────────────────────────────────────

_OK  := \033[32m✔\033[0m
_FAIL := \033[31m✘\033[0m
_WARN := \033[33m!\033[0m

## Check prerequisites and environment
doctor:
	@echo "Checking prerequisites..."
	@echo ""
	@fail=0; \
	\
	if command -v node > /dev/null 2>&1; then \
		node_ver=$$(node -v | sed 's/v//'); \
		node_major=$$(echo $$node_ver | cut -d. -f1); \
		if [ "$$node_major" -ge 20 ]; then \
			printf "  $(_OK) node $$node_ver\n"; \
		else \
			printf "  $(_FAIL) node $$node_ver (need 20+)\n"; fail=1; \
		fi; \
	else \
		printf "  $(_FAIL) node not found\n"; fail=1; \
	fi; \
	\
	if command -v pnpm > /dev/null 2>&1; then \
		pnpm_ver=$$(pnpm -v); \
		printf "  $(_OK) pnpm $$pnpm_ver\n"; \
	else \
		printf "  $(_FAIL) pnpm not found (npm install -g pnpm)\n"; fail=1; \
	fi; \
	\
	if command -v java > /dev/null 2>&1; then \
		java_ver=$$(java -version 2>&1 | head -1 | sed 's/.*"\(.*\)".*/\1/' | cut -d. -f1); \
		printf "  $(_OK) java $$java_ver\n"; \
	else \
		printf "  $(_FAIL) java not found (needed for Firebase emulators)\n"; fail=1; \
	fi; \
	\
	if command -v firebase > /dev/null 2>&1; then \
		fb_ver=$$(firebase --version); \
		printf "  $(_OK) firebase $$fb_ver\n"; \
	elif npx firebase --version > /dev/null 2>&1; then \
		fb_ver=$$(npx firebase --version); \
		printf "  $(_OK) firebase $$fb_ver (via npx)\n"; \
	else \
		printf "  $(_FAIL) firebase CLI not found (npm install -g firebase-tools)\n"; fail=1; \
	fi; \
	\
	if command -v direnv > /dev/null 2>&1; then \
		printf "  $(_OK) direnv\n"; \
	else \
		printf "  $(_WARN) direnv not found (optional, but recommended)\n"; \
	fi; \
	\
	echo ""; \
	if [ -d node_modules ]; then \
		printf "  $(_OK) node_modules installed\n"; \
	else \
		printf "  $(_FAIL) node_modules missing (run pnpm install)\n"; fail=1; \
	fi; \
	\
	if [ -n "$$CYPRESS_BASE_URL" ]; then \
		printf "  $(_OK) CYPRESS_BASE_URL=$$CYPRESS_BASE_URL\n"; \
	else \
		printf "  $(_WARN) CYPRESS_BASE_URL not set (run: direnv allow)\n"; \
	fi; \
	\
	echo ""; \
	if [ $$fail -eq 1 ]; then \
		echo "Some checks failed. Fix the issues above and re-run make doctor."; \
		exit 1; \
	else \
		echo "All good."; \
	fi
