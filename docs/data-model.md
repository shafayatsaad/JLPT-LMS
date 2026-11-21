# Logical data model

```mermaid
erDiagram
  AUTH_USERS ||--|| PROFILES : owns
  AUTH_USERS ||--o{ USER_ROLES : assigned
  PASSAGE_GROUPS ||--o{ QUESTIONS : groups
  QUESTIONS ||--o{ QUESTION_TAGS : labeled
  TAGS ||--o{ QUESTION_TAGS : applies
  QUESTIONS ||--|| QUESTION_ANSWER_KEYS : secures
  QUESTIONS ||--o{ QUESTION_ASSETS : uses
  QUESTIONS ||--o{ QUESTION_REVIEWS : reviewed
  EXAM_BLUEPRINTS ||--o{ BLUEPRINT_SLOTS : defines
  EXAM_BLUEPRINTS ||--o{ EXAM_FORMS : assembles
  EXAM_FORMS ||--o{ EXAM_FORM_ITEMS : freezes
  QUESTIONS ||--o{ EXAM_FORM_ITEMS : selected
  AUTH_USERS ||--o{ EXAM_ATTEMPTS : starts
  EXAM_FORMS ||--o{ EXAM_ATTEMPTS : binds
  EXAM_ATTEMPTS ||--o{ ATTEMPT_SECTIONS : times
  EXAM_ATTEMPTS ||--o{ ATTEMPT_ANSWERS : records
  EXAM_ATTEMPTS ||--o| EXAM_RESULTS : grades
  PLANS ||--o{ USER_ENTITLEMENTS : grants
  AUTH_USERS ||--o{ PAYMENT_SUBMISSIONS : submits
  PAYMENT_SUBMISSIONS ||--o| USER_ENTITLEMENTS : activates
  PAYMENT_SUBMISSIONS ||--o{ PAYMENT_AUDIT_EVENTS : audits
```

`AUTH_USERS` is managed by Supabase Auth. Question revisions and answer keys are server-controlled. Attempt writes, transitions, deadlines, grading, payment verification, and entitlement changes use protected server operations and transactions. PostgreSQL is the operational source of truth; CSV is export-only.
