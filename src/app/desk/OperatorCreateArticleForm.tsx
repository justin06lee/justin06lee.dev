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

const inputClass =
  "w-full bg-black border border-white/20 px-3 py-2 outline-none focus:border-white/40 text-sm text-white placeholder:text-white/40";

export function OperatorCreateArticleForm() {
  const [state, formAction, pending] = useActionState<OperatorFormState, FormData>(
    createArticleAction,
    null
  );
  const [articleName, setArticleName] = useState("");
  const [title, setTitle] = useState("");
  const [titleLinked, setTitleLinked] = useState(true);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">new article</h1>
        <p className="mt-2 text-sm text-white/50">
          creates a new article at the root of the archive. refine the markdown next.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-xs text-white/60 mb-1 block">Label / name</label>
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
            className={inputClass}
          />
        </div>

        <div>
          <label className="text-xs text-white/60 mb-1 block">Article title</label>
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
            className={inputClass}
          />
        </div>

        <div className="sm:col-span-2">
          <label className="text-xs text-white/60 mb-1 block">Prerequisites</label>
          <input
            type="text"
            name="prerequisites"
            placeholder="folders/linear-algebra/vectors-and-spaces"
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label className="text-xs text-white/60 mb-1 block">Initial markdown</label>
        <textarea
          name="content"
          rows={16}
          defaultValue={STARTER_CONTENT}
          className="w-full bg-black border border-white/20 px-3 py-3 font-mono text-sm leading-6 text-white outline-none focus:border-white/40"
        />
      </div>

      {state?.error ? (
        <p className="text-sm text-red-400">{state.error}</p>
      ) : null}

      <div>
        <button
          type="submit"
          disabled={pending}
          className="bg-white text-black px-4 py-1.5 text-sm font-medium hover:bg-white/90 transition-colors disabled:opacity-60"
        >
          {pending ? "Creating..." : "Create article"}
        </button>
      </div>
    </form>
  );
}
