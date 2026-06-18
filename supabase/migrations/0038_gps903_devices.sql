-- GPS903 device catalog populated by auto-discovery sync.
-- Separate from gps_devices (the operational linking table per case).

CREATE TABLE IF NOT EXISTS public.gps903_devices (
  id               uuid        NOT NULL DEFAULT gen_random_uuid(),
  gps903_device_id integer     NOT NULL,
  device_name      text,
  imei             text,
  model            text,
  last_seen        timestamptz,
  synced_at        timestamptz NOT NULL DEFAULT now(),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gps903_devices_pkey               PRIMARY KEY (id),
  CONSTRAINT gps903_devices_gps903_id_key      UNIQUE (gps903_device_id)
);

ALTER TABLE public.gps903_devices ENABLE ROW LEVEL SECURITY;

-- Admins and supervisors can read the catalog
CREATE POLICY "staff_read_gps903_devices"
  ON public.gps903_devices
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'supervisor')
    )
  );

-- Writes are via service role only (sync cron + server actions)

CREATE INDEX IF NOT EXISTS gps903_devices_imei_idx
  ON public.gps903_devices (imei)
  WHERE imei IS NOT NULL;
