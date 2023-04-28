import { MakeLinkOptions } from "@tanstack/router";
import { fallback404Route } from "../routes";

export const handleQueryError = (navigate: (opts?: MakeLinkOptions | undefined) => Promise<void>) => (err: any) => {
  if (err.statusCode === 404) {
    navigate({
      to: fallback404Route.fullPath,
    });
  }
};
