// Revision Engine - constraints & indexes for the production Neo4j store.
// Part 02 adds the Neo4j repository (REVISION_STORE=neo4j). Initialize with:
//   npm run init:revision-db
// which applies ONLY these idempotent statements - it never deletes data,
// never seeds learner records, and is safe to re-run. Initialization is a
// manual operator step, separate from student API requests (the API never
// runs schema statements). Persistent learner records additionally require
// REVISION_PERSIST_LEARNER_DATA=true after legal review - see
// docs/revision-engine-part02.md.
//
// Node labels mirror the five logical entities:
//   (:StudentConceptMastery {student_id, concept_id, ...})
//   (:RevisionSchedule      {student_id, concept_id, scheduled_at, ...})
//   (:RevisionAttempt       {student_id, concept_id, attempted_at, ...})
//   (:RevisionSession       {student_id, session_id, started_at, ...})
//   (:RevisionEvent         {student_id, concept_id, timestamp, ...})
// Every query in the repository interface filters on student_id first;
// the composite indexes below exist for exactly those access paths.

CREATE CONSTRAINT revision_mastery_student_concept IF NOT EXISTS
FOR (m:StudentConceptMastery) REQUIRE (m.student_id, m.concept_id) IS NODE KEY;

CREATE CONSTRAINT revision_schedule_student_concept IF NOT EXISTS
FOR (s:RevisionSchedule) REQUIRE (s.student_id, s.concept_id) IS NODE KEY;

CREATE CONSTRAINT revision_session_student_session IF NOT EXISTS
FOR (s:RevisionSession) REQUIRE (s.student_id, s.session_id) IS NODE KEY;

CREATE CONSTRAINT revision_attempt_id IF NOT EXISTS
FOR (a:RevisionAttempt) REQUIRE a.id IS UNIQUE;

CREATE CONSTRAINT revision_event_id IF NOT EXISTS
FOR (e:RevisionEvent) REQUIRE e.id IS UNIQUE;

CREATE INDEX revision_mastery_student_status IF NOT EXISTS
FOR (m:StudentConceptMastery) ON (m.student_id, m.mastery_status);

CREATE INDEX revision_schedule_student_due IF NOT EXISTS
FOR (s:RevisionSchedule) ON (s.student_id, s.scheduled_at, s.status);

CREATE INDEX revision_attempt_student_concept IF NOT EXISTS
FOR (a:RevisionAttempt) ON (a.student_id, a.concept_id, a.attempted_at);

CREATE INDEX revision_event_student_time IF NOT EXISTS
FOR (e:RevisionEvent) ON (e.student_id, e.timestamp);

// listMastery filters by subject / chapter within one student.
CREATE INDEX revision_mastery_student_subject IF NOT EXISTS
FOR (m:StudentConceptMastery) ON (m.student_id, m.subject_id);

CREATE INDEX revision_mastery_student_chapter IF NOT EXISTS
FOR (m:StudentConceptMastery) ON (m.student_id, m.chapter_id);

CREATE INDEX revision_session_student_time IF NOT EXISTS
FOR (s:RevisionSession) ON (s.student_id, s.started_at);