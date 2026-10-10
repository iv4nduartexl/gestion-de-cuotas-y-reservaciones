"use client";

import { startTransition, useActionState, useEffect, type FormEvent } from "react";
import { toast } from "sonner";

type FormStateAction<S> = (state: Awaited<S>, formData: FormData) => S | Promise<S>;

/**
 * useActionState for forms that must keep their values after a failed
 * submission. Submitting through `onSubmit` skips React's automatic form
 * reset; `action` remains as the no-JavaScript fallback. A returned
 * `message` is shown as a success toast.
 */
export function useFormAction<S extends { message?: string }>(
  action: FormStateAction<S>,
  initialState: Awaited<S>,
) {
  const [state, dispatch, pending] = useActionState(action, initialState);

  useEffect(() => {
    if (state.message) toast.success(state.message);
  }, [state]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => dispatch(formData));
  }

  return { state, pending, formProps: { action: dispatch, onSubmit } };
}
