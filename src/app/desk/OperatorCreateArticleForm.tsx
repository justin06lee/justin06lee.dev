"use client";

import { useActionState, useState } from "react";
import { Input } from "@/components/chrome/input";
import { Textarea } from "@/components/chrome/textarea";
import { Button } from "@/components/chrome/button";
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
    null,
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
          <label className="mb-1 block text-xs text-white/60">Label / name</label>
          <Input
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
            className="w-full"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs text-white/60">Article title</label>
          <Input
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
            className="w-full"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs text-white/60">Prerequisites</label>
          <Input
            type="text"
            name="prerequisites"
            placeholder="folders/linear-algebra/vectors-and-spaces"
            className="w-full"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs text-white/60">Initial markdown</label>
        <Textarea
          name="content"
          rows={16}
          defaultValue={STARTER_CONTENT}
          className="font-mono leading-6"
        />
      </div>

      {state?.error ? (
        <p className="text-sm text-red-400">{state.error}</p>
      ) : null}

      <div>
        <Button type="submit" variant="solid" disabled={pending}>
          {pending ? "Creating..." : "Create article"}
        </Button>
      </div>
    </form>
  );
}
