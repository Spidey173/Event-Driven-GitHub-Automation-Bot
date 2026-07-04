# AI Collaboration & System Architecture Notes

This document details the AI tools used, architectural decisions, debugging pivots, and future improvements for the Event-Driven GitHub Automation Bot.

---

## 1. AI Tools Used

* **Gemini 3.5 Flash (High)** & **Antigravity IDE Agent** (Primary coding assistants)
* **Claude / ChatGPT** (General design brainstorming and mock API reference)

---

## 2. Key Decisions

### Decision 1: FastAPI instead of Node.js
* **Rationale**: Python's type annotations, combined with FastAPI's automatic OpenAPI schema generation (via Pydantic v2), yield a highly typed, self-documenting API. FastAPI's native async capabilities handle high concurrency webhook loads efficiently compared to traditional sync setups.

### Decision 2: BackgroundTasks instead of Celery + Redis
* **Rationale**: The AI initially suggested a complex Celery + Redis architecture to manage task scheduling. For an internship MVP running on free public hosts (Render, Neon), setting up and configuring a separate Redis broker and Celery worker adds significant deployment complexity and cost overhead. Simplifying the design to FastAPI's built-in `BackgroundTasks` executes automation scripts asynchronously in the background while keeping the infrastructure flat.

### Decision 3: Neon PostgreSQL instead of Supabase
* **Rationale**: Supabase provides a full backend-as-a-service layout. For this bot, we needed a thin SQL database mapper combined with complex backend logic. Neon provides an excellent serverless PostgreSQL database with no-card free tiers, which integrates natively with SQLAlchemy 2.0 and Alembic.

---

## 3. Biggest AI Mistake & Resolution

### The Mistake
During the scaffolding phase, the AI proposed a standard Pydantic configuration expecting a strict list representation (`List[str]`) for the `BACKEND_CORS_ORIGINS` setting. However, environment variable loaders (such as `pydantic-settings`) pull variables from `.env` files as raw string literals. Consequently, the server crashed immediately on startup with a `ValidationError`.

### How We Fixed It
Instead of reverting to string lists, we resolved the issue by introducing a custom Pydantic `@BeforeValidator` utility called `parse_cors`:
```python
def parse_cors(v: Union[str, List[str]]) -> List[str]:
    if isinstance(v, str):
        if not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        try:
            return json.loads(v)
        except json.JSONDecodeError:
            return [v.strip()]
    return v
```
This utility automatically parses comma-separated lists and JSON arrays, preventing startup crashes.

---

## 4. Future Improvements

1. **GitHub App Authentication**: Replace static user OAuth tokens with GitHub App JWT keys exchanged dynamically for installation tokens to support granular permissions.
2. **Dedicated Redis Queue**: Shift back to Celery + Redis if webhook execution volumes scale beyond single-instance memory thresholds.
3. **AI Issue Triage (Gemini API)**: Integrate Gemini API to analyze incoming issue titles and bodies, auto-summarize them, and suggest labels/triage priorities dynamically.
4. **Multi-Repository Config Panel**: Enable users to define distinct condition thresholds and custom actions for individual repositories in the dashboard.

---

## 5. AI Context / Instruction Files
* **Status**: No custom AI context or instruction files (such as `CLAUDE.md`, `AGENTS.md`, or `.cursorrules`) were used for this project. All prompts and instructions were given directly to the coding assistant.

---

## 6. How Our AI Collaboration Was Unique (Systems-Level Engineering)

Instead of using the AI as a simple autocomplete tool or copy-pasting bulk boilerplate, our collaboration functioned as a true principal-engineer/architect pair programming loop. 

Here are three key highlights that show the depth of this collaboration:

### 1. Handling State Recovery (Key Rotation Protection)
* **The Situation:** During a project restart, the AI regenerated a new Fernet `ENCRYPTION_KEY`. In a naive setup, this would have permanently orphaned all active GitHub OAuth tokens in the database, requiring users to authenticate from scratch.
* **Our Collaborative Fix:** We diagnosed the decryption failure, traced the command logs, retrieved the exact cryptographic key used for the initial database session, and restored it. This preserved database state integrity and proved the robustness of the encryption scheme.

### 2. Identifying Webhook Infrastructure Routing Gaps
* **The Situation:** The bot deployed on Render was silently failing to capture GitHub webhook triggers because the environment variable `WEBHOOK_BASE_URL` was incorrectly pointing to a dead local `ngrok` tunnel.
* **Our Collaborative Fix:** We inspected the webhook registration payload logs, traced how the backend client dynamically registers callback URLs on GitHub, and updated the host mapping to the live Render backend service. This restored end-to-end communication instantly.

### 3. Implementing Defensive Webhook Engineering
Many developers struggle with webhook reliability due to network drops and double deliveries. Together with the AI, we designed a two-tier reliability system:
* **Event Deduplication:** Enforces unique transaction checks on incoming webhook headers.
* **Action-Level Idempotency:** Logs every action execution, preventing double labeling or double Slack notifications if GitHub retries the delivery.
* **Graceful Failure Degradation:** Ensuring a missing/failed third-party API (like Slack webhooks) does not crash or block core GitHub API operations (like commenting).


