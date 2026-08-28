"use client";

import { useCallback, useState } from "react";

import type { Annotations, Highlight, QuestionHighlight } from "@/lib/player/highlights";

/**
 * Highlights and notes for one attempt.
 *
 * Rides the existing `annotations` column and the existing autosave, which the
 * server stores without interpreting — the shape is the client's business, so
 * adding notes needed no migration and no API change.
 */
export function useAnnotations(
  initial: Annotations,
  save: (annotations: Annotations) => void,
) {
  const [annotations, setAnnotations] = useState<Annotations>(initial);

  const update = useCallback(
    (next: Annotations) => {
      setAnnotations(next);
      save(next);
    },
    [save],
  );

  const addHighlight = useCallback(
    (highlight: Highlight) => {
      update({ ...annotations, highlights: [...(annotations.highlights ?? []), highlight] });
    },
    [annotations, update],
  );

  const removeHighlight = useCallback(
    (id: string) => {
      update({
        ...annotations,
        highlights: (annotations.highlights ?? []).filter((entry) => entry.id !== id),
      });
    },
    [annotations, update],
  );

  const setNote = useCallback(
    (id: string, note: string) => {
      update({
        ...annotations,
        highlights: (annotations.highlights ?? []).map((entry) =>
          entry.id === id ? { ...entry, note: note.trim() || undefined } : entry,
        ),
      });
    },
    [annotations, update],
  );

  const addQuestionHighlight = useCallback(
    (highlight: QuestionHighlight) => {
      update({
        ...annotations,
        questionHighlights: [...(annotations.questionHighlights ?? []), highlight],
      });
    },
    [annotations, update],
  );

  const removeQuestionHighlight = useCallback(
    (id: string) => {
      update({
        ...annotations,
        questionHighlights: (annotations.questionHighlights ?? []).filter(
          (entry) => entry.id !== id,
        ),
      });
    },
    [annotations, update],
  );

  const setScratchpad = useCallback(
    (scratchpad: string) => update({ ...annotations, scratchpad }),
    [annotations, update],
  );

  return {
    annotations,
    highlights: annotations.highlights ?? [],
    questionHighlights: annotations.questionHighlights ?? [],
    scratchpad: annotations.scratchpad ?? "",
    addHighlight,
    removeHighlight,
    addQuestionHighlight,
    removeQuestionHighlight,
    setNote,
    setScratchpad,
  };
}
