use std::{
    collections::HashMap,
    convert::Infallible,
    net::SocketAddr,
    path::{Path, PathBuf},
    process::Stdio,
    sync::Arc,
    time::{Duration, SystemTime, UNIX_EPOCH},
};

use axum::{
    extract::{Path as AxumPath, State},
    http::{HeaderMap, StatusCode},
    response::{sse::Event, IntoResponse, Response, Sse},
    routing::{get, post},
    Json, Router,
};
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tokio::{
    io::{AsyncBufReadExt, BufReader},
    process::{Child, Command},
    sync::{broadcast, Mutex, Semaphore},
    time::timeout,
};
use tokio_stream::{wrappers::BroadcastStream, StreamExt};
use tower_http::{catch_panic::CatchPanicLayer, limit::RequestBodyLimitLayer, trace::TraceLayer};
use tracing::{error, info};
use uuid::Uuid;

const MAX_EVENTS: usize = 256;
const MAX_EVENT_BYTES: usize = 4096;
const SESSION_TIMEOUT: Duration = Duration::from_secs(15);

#[derive(Clone)]
struct AppState {
    sessions: Arc<Mutex<HashMap<Uuid, Session>>>,
    gate: Arc<Semaphore>,
    db: Arc<Mutex<Connection>>,
    config: Arc<Config>,
}

struct Config {
    bind: SocketAddr,
    token: String,
    binary_dir: PathBuf,
    fixture_dir: PathBuf,
    disabled: bool,
    hash_salt: String,
}

struct Session {
    view: SessionView,
    requester_hash: String,
    events: Vec<SessionEvent>,
    tx: broadcast::Sender<SessionEvent>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct LabView {
    id: &'static str,
    slug: &'static str,
    title: &'static str,
    incident: &'static str,
    hosted: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct SessionView {
    id: Uuid,
    lab_id: String,
    status: SessionStatus,
    created_at: u64,
    started_at: Option<u64>,
    finished_at: Option<u64>,
    event_count: usize,
    error_category: Option<String>,
}

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "snake_case")]
enum SessionStatus {
    Queued,
    Running,
    Completed,
    Failed,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct SessionEvent {
    sequence: usize,
    kind: &'static str,
    timestamp: u64,
    data: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreateSession {
    lab_id: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Feedback {
    role: String,
    difficulty: u8,
    rating: u8,
    checkpoint_score: u8,
    comment: Option<String>,
    consent: bool,
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .json()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();
    let config = Config::from_env().unwrap_or_else(|message| panic!("{message}"));
    let db = open_db().unwrap_or_else(|error| panic!("open metrics database: {error}"));
    let state = AppState {
        sessions: Arc::new(Mutex::new(HashMap::new())),
        gate: Arc::new(Semaphore::new(1)),
        db: Arc::new(Mutex::new(db)),
        config: Arc::new(config),
    };
    let bind = state.config.bind;
    let listener = tokio::net::TcpListener::bind(bind)
        .await
        .expect("bind runner");
    info!(%bind, "incident runner listening");
    axum::serve(listener, app(state))
        .await
        .expect("serve runner");
}

fn app(state: AppState) -> Router {
    Router::new()
        .route("/health", get(health))
        .route("/v1/labs", get(list_labs))
        .route("/v1/sessions", post(create_session))
        .route("/v1/sessions/{id}", get(get_session))
        .route("/v1/sessions/{id}/events", get(session_events))
        .route("/v1/sessions/{id}/feedback", post(save_feedback))
        .layer(RequestBodyLimitLayer::new(16 * 1024))
        .layer(CatchPanicLayer::new())
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}

async fn health(State(state): State<AppState>) -> impl IntoResponse {
    Json(serde_json::json!({
        "status": if state.config.disabled { "disabled" } else { "ok" },
        "release": env!("CARGO_PKG_VERSION"),
        "activeCapacity": state.gate.available_permits()
    }))
}

async fn list_labs(State(state): State<AppState>, headers: HeaderMap) -> Response {
    if !authorized(&state, &headers) {
        return unauthorized();
    }
    Json(labs()).into_response()
}

async fn create_session(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(input): Json<CreateSession>,
) -> Response {
    if !authorized(&state, &headers) {
        return unauthorized();
    }
    if state.config.disabled {
        return problem(
            StatusCode::SERVICE_UNAVAILABLE,
            "runner_disabled",
            "New lab sessions are temporarily disabled.",
        );
    }
    if !matches!(input.lab_id.as_str(), "01" | "02" | "07") {
        return problem(
            StatusCode::BAD_REQUEST,
            "lab_not_hosted",
            "Only Labs 01, 02, and 07 are hosted in this release.",
        );
    }
    let id = Uuid::new_v4();
    let now = epoch();
    let requester = requester_hash(&state.config, &headers);
    let view = SessionView {
        id,
        lab_id: input.lab_id.clone(),
        status: SessionStatus::Queued,
        created_at: now,
        started_at: None,
        finished_at: None,
        event_count: 0,
        error_category: None,
    };
    let (tx, _) = broadcast::channel(MAX_EVENTS);
    {
        let mut sessions = state.sessions.lock().await;
        sessions.retain(|_, session| {
            session
                .view
                .finished_at
                .is_none_or(|finished| now.saturating_sub(finished) < 3600)
        });
        let active = |session: &&Session| {
            matches!(
                session.view.status,
                SessionStatus::Queued | SessionStatus::Running
            )
        };
        if sessions
            .values()
            .filter(active)
            .any(|session| session.requester_hash == requester)
        {
            return problem(
                StatusCode::CONFLICT,
                "session_already_active",
                "This client already has an active or queued session.",
            );
        }
        if sessions.values().filter(active).count() >= 8 {
            return problem(
                StatusCode::TOO_MANY_REQUESTS,
                "queue_full",
                "The bounded runner queue is full. Try again shortly.",
            );
        }
        sessions.insert(
            id,
            Session {
                view: view.clone(),
                requester_hash: requester.clone(),
                events: Vec::new(),
                tx,
            },
        );
    }
    if let Err(error) = record_session(&state, &view, &requester).await {
        error!(%error, "failed to record session");
    }
    tokio::spawn(run_session(state.clone(), id, input.lab_id));
    (StatusCode::ACCEPTED, Json(view)).into_response()
}

async fn get_session(
    State(state): State<AppState>,
    headers: HeaderMap,
    AxumPath(id): AxumPath<Uuid>,
) -> Response {
    if !authorized(&state, &headers) {
        return unauthorized();
    }
    match state.sessions.lock().await.get(&id) {
        Some(session) => Json(session.view.clone()).into_response(),
        None => problem(
            StatusCode::NOT_FOUND,
            "session_not_found",
            "The session does not exist or has expired.",
        ),
    }
}

async fn session_events(
    State(state): State<AppState>,
    headers: HeaderMap,
    AxumPath(id): AxumPath<Uuid>,
) -> Response {
    if !authorized(&state, &headers) {
        return unauthorized();
    }
    let (snapshot, receiver) = {
        let sessions = state.sessions.lock().await;
        let Some(session) = sessions.get(&id) else {
            return problem(
                StatusCode::NOT_FOUND,
                "session_not_found",
                "The session does not exist or has expired.",
            );
        };
        (session.events.clone(), session.tx.subscribe())
    };
    let replay = tokio_stream::iter(snapshot.into_iter().map(Ok::<_, Infallible>));
    let live = BroadcastStream::new(receiver).filter_map(|event| match event {
        Ok(event) => Some(Ok::<_, Infallible>(event)),
        Err(_) => None,
    });
    let stream = replay.chain(live).map(|event| {
        event.map(|event| {
            let data = serde_json::to_string(&event)
                .unwrap_or_else(|_| "{\"kind\":\"serialization_error\"}".into());
            Event::default().event(event.kind).data(data)
        })
    });
    Sse::new(stream)
        .keep_alive(
            axum::response::sse::KeepAlive::new()
                .interval(Duration::from_secs(5))
                .text("keepalive"),
        )
        .into_response()
}

async fn save_feedback(
    State(state): State<AppState>,
    headers: HeaderMap,
    AxumPath(id): AxumPath<Uuid>,
    Json(input): Json<Feedback>,
) -> Response {
    if !authorized(&state, &headers) {
        return unauthorized();
    }
    if !input.consent
        || !(1..=5).contains(&input.difficulty)
        || !(1..=5).contains(&input.rating)
        || input.checkpoint_score > 2
    {
        return problem(
            StatusCode::BAD_REQUEST,
            "invalid_feedback",
            "Consent, ratings from 1 to 5, and a checkpoint score from 0 to 2 are required.",
        );
    }
    let roles = ["devops", "sre", "systems", "platform", "other"];
    if !roles.contains(&input.role.as_str())
        || input.comment.as_deref().unwrap_or("").chars().count() > 1000
    {
        return problem(
            StatusCode::BAD_REQUEST,
            "invalid_feedback",
            "Use an allowed role and keep the optional comment under 1,000 characters.",
        );
    }
    if !state.sessions.lock().await.contains_key(&id) {
        return problem(
            StatusCode::NOT_FOUND,
            "session_not_found",
            "The session does not exist or has expired.",
        );
    }
    let comment = input.comment.unwrap_or_default();
    let db = state.db.lock().await;
    let result = db.execute(
        "INSERT INTO feedback(session_id, role, difficulty, rating, checkpoint_score, comment, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![id.to_string(), input.role, input.difficulty, input.rating, input.checkpoint_score, comment, epoch()],
    );
    match result {
        Ok(_) => (
            StatusCode::CREATED,
            Json(serde_json::json!({"saved": true})),
        )
            .into_response(),
        Err(error) => {
            error!(%error, "save feedback");
            problem(
                StatusCode::INTERNAL_SERVER_ERROR,
                "storage_error",
                "Feedback could not be saved.",
            )
        }
    }
}

async fn run_session(state: AppState, id: Uuid, lab_id: String) {
    let permit = match state.gate.acquire().await {
        Ok(permit) => permit,
        Err(_) => return,
    };
    update_status(&state, id, SessionStatus::Running, None).await;
    push_event(
        &state,
        id,
        "status",
        "Runner acquired. Starting a bounded observation.".into(),
    )
    .await;
    let result = timeout(SESSION_TIMEOUT, execute_lab(&state, id, &lab_id)).await;
    let (status, error_category, message) = match result {
        Ok(Ok(())) => (
            SessionStatus::Completed,
            None,
            "Observation completed and cleanup finished.",
        ),
        Ok(Err(error)) => {
            error!(%id, %error, "session failed");
            (
                SessionStatus::Failed,
                Some("execution_failed".into()),
                "The observer failed. No successful run is claimed.",
            )
        }
        Err(_) => (
            SessionStatus::Failed,
            Some("timeout".into()),
            "The session exceeded its hard timeout and was terminated.",
        ),
    };
    drop(permit);
    update_status(&state, id, status, error_category).await;
    push_event(&state, id, "terminal", message.into()).await;
}

async fn execute_lab(state: &AppState, id: Uuid, lab_id: &str) -> Result<(), String> {
    let (binary, fixture) = match lab_id {
        "01" => ("01-exec-watch", Fixture::Exec),
        "02" => ("02-file-open", Fixture::File),
        "07" => ("07-verifier-portability", Fixture::Write),
        _ => return Err("lab is not allowlisted".into()),
    };
    let mut paused = match fixture {
        Fixture::Exec => Some(spawn_paused("exec", &state.config.fixture_dir).await?),
        Fixture::File => Some(spawn_paused("file", &state.config.fixture_dir).await?),
        Fixture::Write => Some(spawn_paused("write", &state.config.fixture_dir).await?),
    };
    let mut command = Command::new(state.config.binary_dir.join(binary));
    command.arg("--json").arg("--duration").arg("3");
    if let Some(child) = paused.as_ref() {
        command
            .arg("--pid")
            .arg(child.id().ok_or("paused fixture has no PID")?.to_string());
    }
    command
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true);
    let mut observer = command
        .spawn()
        .map_err(|error| format!("spawn observer: {error}"))?;
    let stdout = observer
        .stdout
        .take()
        .ok_or("observer stdout unavailable")?;
    let stderr = observer
        .stderr
        .take()
        .ok_or("observer stderr unavailable")?;
    let stdout_state = state.clone();
    let stdout_task = tokio::spawn(async move {
        let mut lines = BufReader::new(stdout).lines();
        while let Ok(Some(line)) = lines.next_line().await {
            if line.len() <= MAX_EVENT_BYTES {
                push_event(&stdout_state, id, "observation", line).await;
            }
        }
    });
    let mut err_lines = BufReader::new(stderr).lines();
    timeout(Duration::from_secs(5), async {
        while let Ok(Some(line)) = err_lines.next_line().await {
            if line.contains("READY") {
                return Ok(());
            }
            push_event(
                state,
                id,
                "diagnostic",
                line.chars().take(MAX_EVENT_BYTES).collect(),
            )
            .await;
        }
        Err("observer exited before readiness".to_string())
    })
    .await
    .map_err(|_| "observer readiness timeout".to_string())??;
    match fixture {
        Fixture::Exec | Fixture::File | Fixture::Write => {
            let child = paused.as_mut().expect("paused fixture exists");
            let pid = child.id().ok_or("fixture PID unavailable")?;
            let status = Command::new("kill")
                .arg("-CONT")
                .arg(pid.to_string())
                .status()
                .await
                .map_err(|e| e.to_string())?;
            if !status.success() {
                return Err("failed to continue fixed fixture".into());
            }
            child.wait().await.map_err(|e| e.to_string())?;
        }
    }
    let status = observer
        .wait()
        .await
        .map_err(|e| format!("wait observer: {e}"))?;
    let _ = stdout_task.await;
    if !status.success() {
        return Err(format!("observer exited with {status}"));
    }
    let observed = state
        .sessions
        .lock()
        .await
        .get(&id)
        .map(|s| s.events.iter().any(|e| e.kind == "observation"))
        .unwrap_or(false);
    if !observed {
        return Err("observer produced no attributable event".into());
    }
    Ok(())
}

enum Fixture {
    Exec,
    File,
    Write,
}

async fn spawn_paused(kind: &str, fixture_dir: &Path) -> Result<Child, String> {
    let (payload, fixture_binary) = match kind {
        "write" => ("echo verifier-hosted >/dev/null; sleep 0.2", None),
        "file" => (
            "exec \"$FIXTURE_BIN\"",
            Some(fixture_dir.join("file-fixture")),
        ),
        _ => ("exec /bin/sleep 0.2", None),
    };
    let mut command = Command::new("bash");
    command.arg("-c").arg(format!("kill -STOP $$; {payload}"));
    if let Some(path) = fixture_binary {
        command.env("FIXTURE_BIN", path);
    }
    command
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .kill_on_drop(true)
        .spawn()
        .map_err(|error| format!("spawn fixed fixture: {error}"))
}

async fn push_event(state: &AppState, id: Uuid, kind: &'static str, data: String) {
    let mut sessions = state.sessions.lock().await;
    let Some(session) = sessions.get_mut(&id) else {
        return;
    };
    let limit = if kind == "terminal" {
        MAX_EVENTS
    } else {
        MAX_EVENTS - 1
    };
    if session.events.len() >= limit {
        return;
    }
    let event = SessionEvent {
        sequence: session.events.len() + 1,
        kind,
        timestamp: epoch(),
        data,
    };
    session.view.event_count = event.sequence;
    session.events.push(event.clone());
    let _ = session.tx.send(event);
}

async fn update_status(
    state: &AppState,
    id: Uuid,
    status: SessionStatus,
    error_category: Option<String>,
) {
    let mut sessions = state.sessions.lock().await;
    if let Some(session) = sessions.get_mut(&id) {
        session.view.status = status;
        match status {
            SessionStatus::Running => session.view.started_at = Some(epoch()),
            SessionStatus::Completed | SessionStatus::Failed => {
                session.view.finished_at = Some(epoch())
            }
            SessionStatus::Queued => {}
        }
        session.view.error_category = error_category;
        if let Err(error) = persist_status(&state.db, &session.view).await {
            error!(%error, "persist session status");
        }
    }
}

fn authorized(state: &AppState, headers: &HeaderMap) -> bool {
    let supplied = headers
        .get("x-incident-runner-token")
        .and_then(|v| v.to_str().ok());
    supplied == Some(state.config.token.as_str())
}

fn unauthorized() -> Response {
    problem(
        StatusCode::UNAUTHORIZED,
        "unauthorized",
        "Runner authentication failed.",
    )
}

fn problem(status: StatusCode, code: &str, message: &str) -> Response {
    (
        status,
        Json(serde_json::json!({"error": code, "message": message})),
    )
        .into_response()
}

fn requester_hash(config: &Config, headers: &HeaderMap) -> String {
    let value = headers
        .get("x-incident-client")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("unknown");
    let mut hasher = Sha256::new();
    hasher.update(config.hash_salt.as_bytes());
    hasher.update(value.as_bytes());
    format!("{:x}", hasher.finalize())
}

fn epoch() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

fn labs() -> [LabView; 7] {
    [
        LabView {
            id: "01",
            slug: "exec-watch",
            title: "What Just Ran on My Server?",
            incident: "A short-lived process disappears before ordinary monitoring sees it.",
            hosted: true,
        },
        LabView {
            id: "02",
            slug: "file-open",
            title: "Who Touched This File—and Did It Fail?",
            incident: "A service repeatedly opens a missing or forbidden file.",
            hosted: true,
        },
        LabView {
            id: "03",
            slug: "connect-failures",
            title: "Why Can’t This Service Connect?",
            incident: "A client fails before application telemetry explains why.",
            hosted: false,
        },
        LabView {
            id: "04",
            slug: "dns-latency",
            title: "Is DNS Actually the Slow Part?",
            incident: "A request is slow and DNS is only one possible boundary.",
            hosted: false,
        },
        LabView {
            id: "05",
            slug: "tcp-retransmits",
            title: "Why Does the Network Keep Retrying?",
            incident: "Latency coincides with transport retransmission.",
            hosted: false,
        },
        LabView {
            id: "06",
            slug: "namespace-pids",
            title: "Why Is PID 1 Not PID 1?",
            incident: "Container and host identifiers appear to contradict each other.",
            hosted: false,
        },
        LabView {
            id: "07",
            slug: "verifier-portability",
            title: "Reading Verifier Errors and Surviving Kernel Drift",
            incident: "A program that looked valid fails at the kernel boundary.",
            hosted: true,
        },
    ]
}

fn open_db() -> rusqlite::Result<Connection> {
    let path = std::env::var("INCIDENT_DB_PATH")
        .unwrap_or_else(|_| "runner-data/incident-lab.sqlite3".into());
    if let Some(parent) = Path::new(&path).parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    let db = Connection::open(path)?;
    db.execute_batch("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=3000;
      CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY, lab_id TEXT NOT NULL, requester_hash TEXT NOT NULL, status TEXT NOT NULL, created_at INTEGER NOT NULL, started_at INTEGER, finished_at INTEGER, event_count INTEGER NOT NULL DEFAULT 0, error_category TEXT);
      CREATE TABLE IF NOT EXISTS feedback(id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT NOT NULL, role TEXT NOT NULL, difficulty INTEGER NOT NULL, rating INTEGER NOT NULL, checkpoint_score INTEGER NOT NULL, comment TEXT NOT NULL, created_at INTEGER NOT NULL);")?;
    recover_interrupted_sessions(&db, epoch())?;
    Ok(db)
}

fn recover_interrupted_sessions(db: &Connection, finished_at: u64) -> rusqlite::Result<usize> {
    db.execute(
        "UPDATE sessions SET status='failed', finished_at=?1, error_category='service_restart' WHERE status IN ('queued', 'running')",
        params![finished_at],
    )
}

async fn record_session(
    state: &AppState,
    view: &SessionView,
    requester: &str,
) -> rusqlite::Result<()> {
    state.db.lock().await.execute(
        "INSERT INTO sessions(id, lab_id, requester_hash, status, created_at, event_count) VALUES (?1, ?2, ?3, 'queued', ?4, 0)",
        params![view.id.to_string(), view.lab_id, requester, view.created_at],
    )?;
    Ok(())
}

async fn persist_status(db: &Arc<Mutex<Connection>>, view: &SessionView) -> rusqlite::Result<()> {
    let status = serde_json::to_value(view.status)
        .unwrap_or_default()
        .as_str()
        .unwrap_or("unknown")
        .to_string();
    db.lock().await.execute(
        "UPDATE sessions SET status=?2, started_at=?3, finished_at=?4, event_count=?5, error_category=?6 WHERE id=?1",
        params![view.id.to_string(), status, view.started_at, view.finished_at, view.event_count, view.error_category],
    )?;
    Ok(())
}

impl Config {
    fn from_env() -> Result<Self, String> {
        let token = std::env::var("INCIDENT_RUNNER_TOKEN")
            .map_err(|_| "INCIDENT_RUNNER_TOKEN is required")?;
        if token.len() < 32 {
            return Err("INCIDENT_RUNNER_TOKEN must contain at least 32 characters".into());
        }
        Ok(Self {
            bind: std::env::var("INCIDENT_RUNNER_BIND")
                .unwrap_or_else(|_| "127.0.0.1:8080".into())
                .parse()
                .map_err(|_| "invalid INCIDENT_RUNNER_BIND")?,
            token,
            binary_dir: std::env::var("INCIDENT_BINARY_DIR")
                .unwrap_or_else(|_| "target/release".into())
                .into(),
            fixture_dir: std::env::var("INCIDENT_FIXTURE_DIR")
                .unwrap_or_else(|_| "target/release".into())
                .into(),
            disabled: std::env::var("INCIDENT_DISABLE_SESSIONS")
                .is_ok_and(|value| value == "1" || value.eq_ignore_ascii_case("true")),
            hash_salt: std::env::var("INCIDENT_HASH_SALT")
                .unwrap_or_else(|_| Uuid::new_v4().to_string()),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{
        body::{to_bytes, Body},
        http::{self, Request},
    };
    use tower::ServiceExt;

    fn state(disabled: bool) -> AppState {
        let db = Connection::open_in_memory().unwrap();
        db.execute_batch("CREATE TABLE sessions(id TEXT PRIMARY KEY, lab_id TEXT, requester_hash TEXT, status TEXT, created_at INTEGER, started_at INTEGER, finished_at INTEGER, event_count INTEGER, error_category TEXT); CREATE TABLE feedback(id INTEGER PRIMARY KEY, session_id TEXT, role TEXT, difficulty INTEGER, rating INTEGER, checkpoint_score INTEGER, comment TEXT, created_at INTEGER);").unwrap();
        AppState {
            sessions: Arc::new(Mutex::new(HashMap::new())),
            gate: Arc::new(Semaphore::new(1)),
            db: Arc::new(Mutex::new(db)),
            config: Arc::new(Config {
                bind: "127.0.0.1:0".parse().unwrap(),
                token: "01234567890123456789012345678901".into(),
                binary_dir: "/missing".into(),
                fixture_dir: "/missing".into(),
                disabled,
                hash_salt: "test".into(),
            }),
        }
    }

    fn request(method: http::Method, uri: &str, body: &str, authenticated: bool) -> Request<Body> {
        let mut builder = Request::builder()
            .method(method)
            .uri(uri)
            .header("content-type", "application/json");
        if authenticated {
            builder = builder.header(
                "x-incident-runner-token",
                "01234567890123456789012345678901",
            );
        }
        builder.body(Body::from(body.to_string())).unwrap()
    }

    #[tokio::test]
    async fn health_is_public_and_explicit_when_disabled() {
        let response = app(state(true))
            .oneshot(request(http::Method::GET, "/health", "", false))
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::OK);
        let body = to_bytes(response.into_body(), 4096).await.unwrap();
        assert!(std::str::from_utf8(&body).unwrap().contains("disabled"));
    }

    #[tokio::test]
    async fn protected_routes_require_the_runner_token() {
        let response = app(state(false))
            .oneshot(request(http::Method::GET, "/v1/labs", "", false))
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    }

    #[tokio::test]
    async fn only_three_fixed_labs_can_start() {
        let app = app(state(false));
        let rejected = app
            .clone()
            .oneshot(request(
                http::Method::POST,
                "/v1/sessions",
                r#"{"labId":"05"}"#,
                true,
            ))
            .await
            .unwrap();
        assert_eq!(rejected.status(), StatusCode::BAD_REQUEST);
        let accepted = app
            .oneshot(request(
                http::Method::POST,
                "/v1/sessions",
                r#"{"labId":"01"}"#,
                true,
            ))
            .await
            .unwrap();
        assert_eq!(accepted.status(), StatusCode::ACCEPTED);
    }

    #[tokio::test]
    async fn emergency_switch_preserves_health_but_blocks_sessions() {
        let response = app(state(true))
            .oneshot(request(
                http::Method::POST,
                "/v1/sessions",
                r#"{"labId":"01"}"#,
                true,
            ))
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::SERVICE_UNAVAILABLE);
    }

    #[tokio::test]
    async fn duplicate_active_session_for_the_same_client_is_rejected() {
        let state = state(false);
        let id = Uuid::new_v4();
        let (tx, _) = broadcast::channel(MAX_EVENTS);
        state.sessions.lock().await.insert(
            id,
            Session {
                view: SessionView {
                    id,
                    lab_id: "01".into(),
                    status: SessionStatus::Running,
                    created_at: epoch(),
                    started_at: Some(epoch()),
                    finished_at: None,
                    event_count: 0,
                    error_category: None,
                },
                requester_hash: requester_hash(&state.config, &HeaderMap::new()),
                events: Vec::new(),
                tx,
            },
        );
        let response = app(state)
            .oneshot(request(
                http::Method::POST,
                "/v1/sessions",
                r#"{"labId":"02"}"#,
                true,
            ))
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::CONFLICT);
    }

    #[tokio::test]
    async fn output_limit_always_reserves_the_terminal_event() {
        let state = state(false);
        let id = Uuid::new_v4();
        let (tx, _) = broadcast::channel(MAX_EVENTS);
        state.sessions.lock().await.insert(
            id,
            Session {
                view: SessionView {
                    id,
                    lab_id: "02".into(),
                    status: SessionStatus::Running,
                    created_at: epoch(),
                    started_at: Some(epoch()),
                    finished_at: None,
                    event_count: 0,
                    error_category: None,
                },
                requester_hash: "test".into(),
                events: Vec::new(),
                tx,
            },
        );
        for sequence in 0..(MAX_EVENTS + 10) {
            push_event(&state, id, "observation", sequence.to_string()).await;
        }
        push_event(&state, id, "terminal", "completed".into()).await;
        let sessions = state.sessions.lock().await;
        let session = sessions.get(&id).unwrap();
        assert_eq!(session.events.len(), MAX_EVENTS);
        assert_eq!(session.events.last().unwrap().kind, "terminal");
    }

    #[test]
    fn startup_marks_interrupted_sessions_as_failed() {
        let db = Connection::open_in_memory().unwrap();
        db.execute_batch("CREATE TABLE sessions(id TEXT PRIMARY KEY, lab_id TEXT, requester_hash TEXT, status TEXT, created_at INTEGER, started_at INTEGER, finished_at INTEGER, event_count INTEGER, error_category TEXT); INSERT INTO sessions(id, lab_id, requester_hash, status, created_at, event_count) VALUES ('one', '01', 'hash', 'running', 1, 2);").unwrap();
        assert_eq!(recover_interrupted_sessions(&db, 99).unwrap(), 1);
        let recovered: (String, u64, String) = db
            .query_row(
                "SELECT status, finished_at, error_category FROM sessions WHERE id='one'",
                [],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
            .unwrap();
        assert_eq!(recovered, ("failed".into(), 99, "service_restart".into()));
    }

    #[test]
    fn catalog_marks_only_the_release_allowlist_as_hosted() {
        let hosted: Vec<_> = labs()
            .into_iter()
            .filter(|lab| lab.hosted)
            .map(|lab| lab.id)
            .collect();
        assert_eq!(hosted, ["01", "02", "07"]);
    }
}
