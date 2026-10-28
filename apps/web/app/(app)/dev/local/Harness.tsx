"use client";

import { useState } from "react";
import { LocationPicker, type PickedLocation } from "@/components/location/LocationPicker";

export function LocationPickerHarness() {
  const [value, setValue] = useState<PickedLocation | null>(null);
  return (
    <div className="flex flex-col gap-4">
      <LocationPicker
        value={value}
        onChange={setValue}
        privacyNote="Mostraremos um local aproximado. Seu endereço não aparece."
      />
      <pre data-testid="harness-output" className="overflow-x-auto rounded-md bg-surface-muted p-3 text-xs">
        {JSON.stringify(value)}
      </pre>
    </div>
  );
}
