// Burst test: many parents apply for a few seats at the same moment.
// Passes only if EXACTLY `SEATS` applications succeed, no request fails with a 5xx,
// and the server's own count agrees afterwards (rule 1: held + confirmed never exceeds the seats).
//
//   docker compose --profile load run --rm k6
import http from 'k6/http';
import { check } from 'k6';
import { Counter } from 'k6/metrics';

const API = __ENV.API_BASE_URL || 'http://backend:8080';
const SEATS = Number(__ENV.SEATS || 120);
const APPLICANTS = Number(__ENV.APPLICANTS || 2000);

const admitted = new Counter('admitted');       // 201 responses
const seatsFull = new Counter('seats_full');    // 409 SEATS_FULL responses
const serverErrors = new Counter('server_errors');

export const options = {
  scenarios: {
    // One burst: APPLICANTS arrivals within one second.
    burst: {
      executor: 'constant-arrival-rate',
      rate: APPLICANTS,
      timeUnit: '1s',
      duration: '1s',
      preAllocatedVUs: APPLICANTS + 50,
      maxVUs: APPLICANTS + 200,
    },
  },
  thresholds: {
    admitted: [`count==${SEATS}`],       // exactly the seats, never more
    server_errors: ['count==0'],         // no 5xx under load
    checks: ['rate==1'],                 // every response was a 201 or a clean 409
    dropped_iterations: ['count==0'],    // every applicant really sent a request (none dropped by the load generator)
    http_req_duration: ['p(95)<3000'],   // generous ceiling; real numbers are reported
  },
  // Only 201 and 409 are expected; anything else is a failed request.
  noConnectionReuse: false,
};

const json = { 'Content-Type': 'application/json' };
const params = { headers: json, responseCallback: http.expectedStatuses(201, 409) };

export function setup() {
  const res = http.post(`${API}/classes`, JSON.stringify({ name: `Load test ${Date.now()}`, totalSeats: SEATS }), { headers: json });
  check(res, { 'class created': (r) => r.status === 201 });
  return { classId: res.json('id') };
}

export default function (data) {
  // A unique 17-digit id per applicant: VU number and iteration packed into 16 digits.
  const n = `${__VU}`.padStart(4, '0') + `${__ITER}`.padStart(12, '0');
  const studentId = '9' + n;
  const res = http.post(`${API}/classes/${data.classId}/holds`, null, {
    ...params,
    headers: { ...json, 'X-Student-Id': studentId },
  });

  if (res.status >= 500) serverErrors.add(1);
  if (res.status === 201) admitted.add(1);
  if (res.status === 409 && res.json('error') === 'SEATS_FULL') seatsFull.add(1);

  check(res, {
    'created or seats full': (r) => r.status === 201 || (r.status === 409 && r.json('error') === 'SEATS_FULL'),
  });
}

export function teardown(data) {
  const res = http.get(`${API}/classes/${data.classId}`);
  const stats = res.json();
  const ok = check(res, {
    'server agrees: held + confirmed == seats': () => stats.heldSeats + stats.confirmedSeats === SEATS,
    'server agrees: nothing available': () => stats.availableSeats === 0,
  });
  if (!ok) console.error(`Server reports held=${stats.heldSeats} confirmed=${stats.confirmedSeats} available=${stats.availableSeats}`);
}
