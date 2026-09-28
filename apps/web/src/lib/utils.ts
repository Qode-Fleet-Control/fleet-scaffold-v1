import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// The shadcn/ui class-merge helper.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
