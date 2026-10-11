"use client";

import { Loader2Icon, SearchIcon, UserPlusIcon, XIcon } from "lucide-react";
import { useRef, useState, useTransition } from "react";

import { searchClientsAction } from "@/app/dashboard/clients/actions";
import { Field } from "@/components/forms/field";
import { FormField } from "@/components/forms/form-field";
import { PhoneInput } from "@/components/forms/py-inputs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EntityAvatar } from "@/components/ui-kit/entity-avatar";
import { formatPhone } from "@/lib/phone";

export type ClientOption = { id: string; name: string; phone: string };

/**
 * Pick an existing client (search by name, phone or C.I.) or type a new one.
 * Inside a form it posts `clientId`, or `newClientName` + `newClientPhone`.
 */
export function ClientPicker({
  clientNoun,
  errors,
  client,
  onClientChange,
}: {
  clientNoun: string;
  errors: Record<string, string | undefined>;
  client: ClientOption | null;
  onClientChange: (client: ClientOption | null) => void;
}) {
  const [newClient, setNewClient] = useState(false);
  if (client) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border bg-primary-soft/40 p-3">
        <input type="hidden" name="clientId" value={client.id} />
        <EntityAvatar name={client.name} />
        <span className="flex flex-1 flex-col">
          <span className="font-bold">{client.name}</span>
          <span className="text-sm text-muted-foreground tabular">{formatPhone(client.phone)}</span>
        </span>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Cambiar cliente" onClick={() => onClientChange(null)}>
          <XIcon />
        </Button>
      </div>
    );
  }

  if (newClient) {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <input type="hidden" name="clientId" value="" />
        <FormField name="newClientName" label="Nombre y apellido" error={errors.newClientName ?? errors.client} />
        <Field id="newClientPhone" label="Teléfono / WhatsApp" error={errors.newClientPhone}>
          <PhoneInput id="newClientPhone" name="newClientPhone" invalid={!!errors.newClientPhone} />
        </Field>
        <Button type="button" variant="ghost" className="w-fit" onClick={() => setNewClient(false)}>
          Buscar uno existente
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <input type="hidden" name="clientId" value="" />
      <ClientSearch clientNoun={clientNoun} onPick={onClientChange} />
      <Button type="button" variant="soft" className="w-fit" onClick={() => setNewClient(true)}>
        <UserPlusIcon aria-hidden="true" /> {`Nuevo ${clientNoun}`}
      </Button>
      {errors.client && <p className="text-sm text-destructive">{errors.client}</p>}
    </div>
  );
}

/** Search box + results; tapping a result picks that client. */
export function ClientSearch({ clientNoun, onPick }: { clientNoun: string; onPick: (client: ClientOption) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ClientOption[]>([]);
  const [searching, startSearch] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function search(value: string) {
    setQuery(value);
    if (timer.current) clearTimeout(timer.current);
    if (value.trim().length < 2) {
      setResults([]);
      return;
    }
    timer.current = setTimeout(() => {
      startSearch(async () => setResults(await searchClientsAction(value)));
    }, 250);
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="relative">
        <span className="sr-only">Buscar {clientNoun}</span>
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          value={query}
          onChange={(event) => search(event.target.value)}
          placeholder="Nombre, teléfono o C.I."
          aria-label={`Buscar ${clientNoun}`}
          className="pl-9"
          autoComplete="off"
        />
        {searching && <Loader2Icon className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-hidden="true" />}
      </label>
      {results.length > 0 && (
        <ul className="flex flex-col divide-y overflow-hidden rounded-2xl border">
          {results.map((option) => (
            <li key={option.id}>
              <button type="button" onClick={() => onPick(option)} className="flex w-full cursor-pointer items-center gap-3 p-3 text-left hover:bg-muted">
                <EntityAvatar name={option.name} size="sm" />
                <span className="font-semibold">{option.name}</span>
                <span className="ml-auto text-sm text-muted-foreground tabular">{formatPhone(option.phone)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {query.trim().length >= 2 && !searching && results.length === 0 && (
        <p className="text-sm text-muted-foreground">No encontramos a nadie con “{query}”.</p>
      )}
    </div>
  );
}
