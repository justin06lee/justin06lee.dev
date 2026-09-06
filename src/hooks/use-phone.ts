"use client";

import { useEffect, useState } from "react";

/**
 * Tailwind's `md` breakpoint, from below. The site's whole mobile layout hangs
 * off `md:`, so anything that has to agree with it in JavaScript reads this
 * rather than writing the number out again.
 */
export const PHONE_QUERY = "(max-width: 767px)";

/**
 * Whether this is a phone-sized viewport.
 *
 * Always `false` on the server and for the first client render, and true only
 * after mount — so the markup the server sent and the markup the client
 * hydrates with are the same. Anything gated on this therefore has to be
 * something a phone *loses*, never something it gains at first paint, or it
 * arrives one frame late and visibly pops in.
 */
export function useIsPhone(): boolean {
  const [phone, setPhone] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(PHONE_QUERY);
    const update = () => setPhone(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return phone;
}
