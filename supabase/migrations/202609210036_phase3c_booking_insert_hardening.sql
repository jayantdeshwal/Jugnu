-- Phase 3C final booking-path hardening.
-- Direct booking inserts are obsolete now that bookings are created only after
-- customer acceptance of a provider quote.

drop policy if exists "Customers can create their own bookings" on public.bookings;
