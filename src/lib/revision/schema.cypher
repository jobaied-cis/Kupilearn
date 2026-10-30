// Revision Engine - constraints & indexes for the production Neo4j store.
// Part 01 ships the in-memory repository (REVISION_STORE=memory, mirroring
// CURRICULUM_GRAPH_DRIVER=memory); apply this file before enabling a Neo4j
// RevisionRepository. All statements are idempotent, matching
// src/lib/curriculum/graph/schema.cypher conventions.
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