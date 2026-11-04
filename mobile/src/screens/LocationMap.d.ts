import type { LocationReading } from "../work/locationEvidence";
import type { ReactElement } from "react";

export function LocationMap(props: {
  reading: LocationReading | null;
  locating?: boolean;
}): ReactElement;
