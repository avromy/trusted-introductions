# Engineering Standards

## Core Rules

- Preserve valuable existing work.
- Do not rewrite the app unless required.
- Do not remove working code without explanation.
- Use the existing stack unless there is a strong reason not to.
- Keep documentation and implementation synchronized.
- Prefer boring, secure, observable architecture.

## Quality Bar

Every change should include relevant tests, documentation updates, and a clear migration path. Before merge, run the available lint, typecheck, test, and build commands.

## Privacy and Trust Requirements

- Privacy settings override convenience.
- Store invite tokens hashed.
- Audit sensitive actions.
- Treat resumes, contact info, and identity data as sensitive.
- Do not expose private profile information through match explanations.

## AI Requirements

- AI may assist with neutral summaries, suggestions, and explanations.
- AI must not write a helper's personal endorsement.
- AI outputs that affect matching should be explainable and reviewable.
