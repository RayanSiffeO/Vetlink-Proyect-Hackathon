import { useState } from 'react';
import {
  createRequestFormState,
  isRequestFormComplete,
  type RequestFormPatch,
  type RequestFormState,
  type RequestPresets,
} from '../lib/requests';

export function useRequestFormState(presets: RequestPresets) {
  const [form, setForm] = useState<RequestFormState>(() => createRequestFormState(presets));
  const update = (patch: RequestFormPatch) => {
    setForm((current) => ({ ...current, ...patch }));
  };
  return { form, update, canSubmit: isRequestFormComplete(form) };
}
