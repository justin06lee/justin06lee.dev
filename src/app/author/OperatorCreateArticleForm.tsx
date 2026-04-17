"use client";

import { useState } from "react";
import { useActionState } from "react";
import { createArticleAction, type OperatorFormState } from "./content-actions";

const STARTER_CONTENT = `cover:
excerpt:
tags:
prerequisites:

## Overview

Write the first section here.

## Key Ideas

- Add the core concepts
- Link to supporting material
- Include diagrams or equations when useful
`;

export function OperatorCreateArticleForm() {
  const [state, formAction, pending] = useActionState<OperatorFormState, FormData>(
    createArticleAction,
    null
  );
  const [articleName, setArticleName] = useState("");
  const [title, setTitle] = useState("");
  const [titleLinked, setTitleLinked] = useState(true);

  return (
    <form action={formAction} className="border border-border bg-surface p-6">
      <div className="mb-6">
        <h1 className="text-3xl tracking-tight text-foreground">New Article</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
          This creates a new article at the root of the archive. You can refine
          the markdown immediately after creation in the editor.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-medium text-foreground">
            Label / Name
          </label>
          <input
            type="text"
            name="article"
            required
            autoFocus
            value={articleName}
            onChange={(event) => {
              const nextArticleName = event.target.value;
              setArticleName(nextArticleName);
              if (titleLinked) {
                setTitle(nextArticleName);
              }
            }}
            placeholder="Vectors and Spaces"
            className="w-full border border-border bg-background px-3 py-2 text-foreground"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-foreground">
            Article title
          </label>
          <input
            type="text"
            name="title"
            required
            value={title}
            onChange={(event) => {
              if (titleLinked) {
                setTitleLinked(false);
              }
              setTitle(event.target.value);
            }}
            placeholder="Vectors and Spaces"
            className="w-full border border-border bg-background px-3 py-2 text-foreground"
          />
        </div>

        <div className="lg:col-span-2">
          <label className="mb-2 block text-sm font-medium text-foreground">
            Prerequisites
          </label>
          <input
            type="text"
            name="prerequisites"
            placeholder="folders/linear-algebra/vectors-and-spaces"
            className="w-full border border-border bg-background px-3 py-2 text-foreground"
          />
        </div>
      </div>

      <div className="mt-5">
        <label className="mb-2 block text-sm font-medium text-foreground">
          Initial markdown
        </label>
        <textarea
          name="content"
          rows={16}
          defaultValue={STARTER_CONTENT}
          className="w-full border border-border bg-background px-3 py-3 font-mono text-sm leading-6 text-foreground"
        />
      </div>

      {state?.error ? (
        <p className="mt-4 text-sm text-red-600 dark:text-red-400">{state.error}</p>
      ) : null}

      <div className="mt-6 flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="border border-foreground bg-foreground px-4 py-2 text-sm font-medium text-background disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Creating..." : "Create article"}
        </button>
      </div>
    </form>
  );
}
