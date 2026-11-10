# Load test: 2,000 applicants, 120 seats

A burst of **2,001 applications** (2,000 parents plus one extra arrival from the rate schedule) hits one class with **120 seats** within one second.

## What it proves

- **Exactly 120 succeed.** Every other request gets a clean `409 SEATS_FULL`.
- **No 5xx errors.** Nothing crashes, times out or corrupts the count under pressure.
- **The server agrees afterwards.** `held + confirmed == 120` and `available == 0` when read back.
- **Every applicant really sent a request.** `dropped_iterations == 0`, so the load generator didn't quietly send fewer requests than advertised.

If any of these fail, the k6 run exits non-zero. The thresholds are in `load/apply-burst.js`.

Response times are reported in the k6 summary but are not a pass/fail gate, because they depend on the machine. The first CI run on GitHub's shared runner measured a p95 of about 3.5 s (slower than this laptop); the correctness results were the same.

## How to run it (Docker only)

```bash
docker compose up -d --wait
docker compose --profile load run --rm k6
```

Settings: `LOAD_SEATS` (default 120) and `LOAD_APPLICANTS` (default 2000).

## Results

Measured on a MacBook (Apple silicon, Docker Desktop with 10 CPUs and about 8 GB for the VM) with the full stack running (`backend`, `db`, `frontend`). Each run creates a fresh class.

| Run | Admitted | `SEATS_FULL` | Server errors | Dropped | p50 | p95 | p max | Requests/s |
|---|---|---|---|---|---|---|---|---|
| 2 (first full-size run) | 120 | 1,881 | 0 | 0 | 821 ms | 1.12 s | 1.15 s | 926 |
| 3 | 120 | 1,881 | 0 | 0 | 491 ms | 725 ms | 750 ms | 1,139 |
| 4 | 120 | 1,882 | 0 | 0 | 466 ms | 717 ms | 739 ms | 1,148 |
| 5 (final, clean rebuild) | 120 | 1,881 | 0 | 0 | 607 ms | 812 ms | 824 ms | 1,094 |

Run 2 is slower because it's the first run after the stack starts, so it includes warm-up (connection pool and JIT). Runs 3, 4 and 5 are representative. Run 5 was the final verification run, on a clean stack rebuilt from source.

Response times are the time from request to response, including the wait for the class's row lock. Requests for one class are serialised by that lock, so most of the time is queueing, not work. That's by design: it's what keeps the count exact.

The k6 run's first request in each run creates the class; setup and teardown are not included in the latency figures.

## Honest limits

- This is one laptop running everything on the same machine, so the load generator competes with the server for CPU. Numbers on a real server would differ.
- The burst is one second long. It tests the worst case for seat contention, not steady traffic over a whole day.
- Throughput numbers are for this single class. Different classes don't block each other, but this test doesn't measure many classes at once.
